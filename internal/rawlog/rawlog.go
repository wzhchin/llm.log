// Package rawlog writes full request/response transcripts to per-request log files.
//
// File layout:  <logsDir>/MM-DD/YYYYMMDDTHHMMSS_<sqliteID>.log
//
// Each file uses line prefixes to distinguish request, response, error, and summary:
//
//	REQ| POST /v1/chat/completions HTTP/1.1
//	REQ| Host: api.openai.com
//	REQ| Authorization: Bearer sk-abc...***
//	REQ|
//	REQ| {"model":"gpt-4","messages":[...]}
//	RES| HTTP/1.1 200 OK
//	RES| Content-Type: text/event-stream
//	RES|
//	RES| data: {"choices":[{"delta":{"content":"Hello"}}]}
//	RES| data: [DONE]
//	END| Status: 200  Duration: 1234ms  Streaming: true
package rawlog

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Logger manages the raw log directory and writes transcript files.
// It is safe for concurrent use via per-request Entry objects.
type Logger struct {
	logsDir string
	enabled bool
}

// New creates a Logger. If logsDir is empty it defaults to ~/.llm.log/logs.
// If enabled is false, all methods are no-ops.
func New(dataDir string, enabled bool) *Logger {
	if !enabled {
		return &Logger{enabled: false}
	}
	return &Logger{
		logsDir: filepath.Join(dataDir, "logs"),
		enabled: true,
	}
}

// Enabled returns whether raw logging is active.
func (l *Logger) Enabled() bool { return l.enabled }

// NewEntry starts building a transcript for one HTTP transaction.
// The returned Entry buffers everything in memory; call Write to flush.
func (l *Logger) NewEntry(ts time.Time) *Entry {
	if !l.enabled {
		return nil
	}
	id := shortID()
	name := ts.Format("20060102T150405") + "_" + id + ".log"
	dir := filepath.Join(l.logsDir, ts.Format("01-02"))
	return &Entry{
		logger:  l,
		path:    filepath.Join(dir, name),
		dir:     dir,
		buf:     strings.Builder{},
		startTS: ts,
	}
}

// Entry accumulates one request/response transcript and writes it atomically.
type Entry struct {
	logger  *Logger
	path    string
	dir     string
	buf     strings.Builder
	startTS time.Time
	mu      sync.Mutex
	written bool // true after flush has succeeded
}

// Request writes the REQ| section: request line, headers, blank line, body.
func (e *Entry) Request(method, url string, headers http.Header, body []byte) {
	if e == nil {
		return
	}
	e.mu.Lock()
	defer e.mu.Unlock()

	// Request line
	e.writePrefixed("REQ| ", fmt.Sprintf("%s %s HTTP/1.1", method, url))

	// Headers (masked)
	for k, vs := range headers {
		for _, v := range vs {
			e.writePrefixed("REQ| ", k+": "+maskHeader(k, v))
		}
	}

	// Blank separator
	e.buf.WriteByte('\n')

	// Body
	if len(body) > 0 {
		e.writePrefixed("REQ| ", string(body))
	}
}

// Response writes the RES| section: status line, headers, blank line, body.
// For streaming responses, body is the accumulated raw bytes (all SSE chunks concatenated).
func (e *Entry) Response(statusCode int, headers http.Header, body []byte) {
	if e == nil {
		return
	}
	e.mu.Lock()
	defer e.mu.Unlock()

	// Status line
	statusText := http.StatusText(statusCode)
	if statusText == "" {
		statusText = "Unknown"
	}
	e.writePrefixed("RES| ", fmt.Sprintf("HTTP/1.1 %d %s", statusCode, statusText))

	// Headers
	for k, vs := range headers {
		for _, v := range vs {
			e.writePrefixed("RES| ", k+": "+v)
		}
	}

	// Blank separator
	e.buf.WriteByte('\n')

	// Body
	if len(body) > 0 {
		e.writePrefixed("RES| ", string(body))
	}
}

// Error records a processing error using the ERR| prefix.
func (e *Entry) Error(msg string) {
	if e == nil {
		return
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	e.writePrefixed("ERR| ", msg)
}

// End writes the END| summary line and flushes the entire transcript to disk.
func (e *Entry) End(statusCode int, streaming bool, duration time.Duration) {
	if e == nil {
		return
	}
	e.mu.Lock()
	defer e.mu.Unlock()

	e.writePrefixed("END| ",
		fmt.Sprintf("Status: %d  Duration: %dms  Streaming: %v",
			statusCode, duration.Milliseconds(), streaming))

	e.flush()
}

// Write flushes the buffered transcript to a log file.
// Called automatically by End, but can be called directly for errors.
func (e *Entry) Write() {
	if e == nil {
		return
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	e.flush()
}

// flush writes buf to disk. Caller must hold e.mu.
func (e *Entry) flush() {
	if e.logger == nil {
		return
	}

	// mkdir -p the date directory
	os.MkdirAll(e.dir, 0755)

	// Write atomically: create file, write, done.
	// No need for rename dance since each request gets a unique file.
	f, err := os.Create(e.path)
	if err != nil {
		return
	}
	defer f.Close()
	io.WriteString(f, e.buf.String())
	e.written = true
}

// Rename changes the file name from the temporary shortID-based name to one
// based on the SQLite record ID. The new name keeps the same timestamp prefix
// and directory. If the file hasn't been flushed yet or the rename fails, it
// logs a warning and leaves the original file name unchanged.
func (e *Entry) Rename(sqliteID int64) {
	if e == nil {
		return
	}
	e.mu.Lock()
	defer e.mu.Unlock()

	if !e.written {
		return
	}

	ext := filepath.Ext(e.path)
	newName := e.startTS.Format("20060102T150405") + "_" + fmt.Sprintf("%d", sqliteID) + ext
	newPath := filepath.Join(e.dir, newName)

	if err := os.Rename(e.path, newPath); err != nil {
		log.Printf("rawlog: rename %s → %s failed: %v", filepath.Base(e.path), newName, err)
		return
	}
	e.path = newPath
}

// writePrefixed writes text with a prefix on the first line.
// Subsequent lines (from embedded newlines) are written without the prefix
// so multi-line bodies like JSON or SSE chunks remain readable.
func (e *Entry) writePrefixed(prefix, text string) {
	lines := strings.Split(text, "\n")
	for i, line := range lines {
		if i == 0 {
			e.buf.WriteString(prefix)
		}
		e.buf.WriteString(line)
		// Don't add trailing newline if text already ended with one
		if i < len(lines)-1 {
			e.buf.WriteByte('\n')
		}
	}
	e.buf.WriteByte('\n')
}

// maskHeader redacts sensitive header values (API keys, auth tokens).
// Shows first 6 and last 3 characters with ... in between.
func maskHeader(key, value string) string {
	lk := strings.ToLower(key)
	switch {
	case lk == "authorization":
		// "Bearer sk-abc123xyz" → "Bearer sk-abc...yz"
		prefix, rest, ok := strings.Cut(value, " ")
		if ok && len(rest) > 9 {
			return prefix + " " + rest[:6] + "...***"
		}
		if len(value) > 9 {
			return value[:6] + "...***"
		}
		return value + "...***"
	case lk == "x-api-key" || lk == "api-key":
		if len(value) > 9 {
			return value[:6] + "...***"
		}
		return value + "...***"
	default:
		return value
	}
}

// shortID generates an 8-char random hex string.
func shortID() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b)
}
