package rawlog

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestLoggerDisabled(t *testing.T) {
	l := New("", false)
	if l.Enabled() {
		t.Fatal("should be disabled")
	}
	e := l.NewEntry(time.Now())
	if e != nil {
		t.Fatal("NewEntry should return nil when disabled")
	}
	// All methods should be no-ops on nil Entry
	e.Request("GET", "/", nil, nil)
	e.Response(200, nil, nil)
	e.Error("test")
	e.End(200, false, 0)
	e.Write()
}

func TestLoggerWritesFile(t *testing.T) {
	dir := t.TempDir()
	l := New(dir, true)

	ts := time.Date(2025, 6, 2, 14, 30, 52, 0, time.UTC)
	e := l.NewEntry(ts)

	h := http.Header{}
	h.Set("Authorization", "Bearer sk-abc12345xyz")
	h.Set("Content-Type", "application/json")

	e.Request("POST", "/v1/chat/completions", h, []byte(`{"model":"gpt-4"}`))

	respH := http.Header{}
	respH.Set("Content-Type", "text/event-stream")
	e.Response(200, respH, []byte("data: {\"choices\":[{\"delta\":{\"content\":\"Hi\"}}]}\n\ndata: [DONE]\n\n"))

	e.End(200, true, 1234*time.Millisecond)

	// Verify file exists
	expectedDir := filepath.Join(dir, "logs", "06-02")
	entries, err := os.ReadDir(expectedDir)
	if err != nil {
		t.Fatalf("expected log dir: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 file, got %d", len(entries))
	}

	data, err := os.ReadFile(filepath.Join(expectedDir, entries[0].Name()))
	if err != nil {
		t.Fatal(err)
	}

	content := string(data)

	// Check REQ section
	if !strings.Contains(content, "REQ| POST /v1/chat/completions HTTP/1.1") {
		t.Error("missing request line")
	}
	if !strings.Contains(content, "REQ| Authorization: Bearer sk-abc...***") {
		t.Errorf("authorization not masked correctly in:\n%s", content)
	}
	if !strings.Contains(content, "REQ| {\"model\":\"gpt-4\"}") {
		t.Error("missing request body")
	}

	// Check RES section
	if !strings.Contains(content, "RES| HTTP/1.1 200 OK") {
		t.Error("missing response status line")
	}
	if !strings.Contains(content, "RES| data: {\"choices\":") {
		t.Error("missing SSE data in response")
	}

	// Check END section
	if !strings.Contains(content, "END| Status: 200  Duration: 1234ms  Streaming: true") {
		t.Error("missing END summary")
	}
}

func TestMaskHeader(t *testing.T) {
	tests := []struct {
		key, value, want string
	}{
		{"Authorization", "Bearer sk-longkey123", "Bearer sk-lon...***"},
		{"authorization", "Bearer sk-longkey123", "Bearer sk-lon...***"},
		{"X-Api-Key", "sk-short", "sk-short...***"},
		{"Content-Type", "application/json", "application/json"},
		{"Authorization", "short", "short...***"},
	}
	for _, tt := range tests {
		got := maskHeader(tt.key, tt.value)
		if got != tt.want {
			t.Errorf("maskHeader(%q, %q) = %q, want %q", tt.key, tt.value, got, tt.want)
		}
	}
}

func TestMultiLineBody(t *testing.T) {
	dir := t.TempDir()
	l := New(dir, true)

	ts := time.Date(2025, 6, 2, 14, 30, 52, 0, time.UTC)
	e := l.NewEntry(ts)

	body := "{\n  \"model\": \"gpt-4\",\n  \"messages\": []\n}"
	e.Request("POST", "/v1/chat/completions", http.Header{}, []byte(body))
	e.End(200, false, 100*time.Millisecond)

	// Read file
	entries, _ := os.ReadDir(filepath.Join(dir, "logs", "06-02"))
	data, _ := os.ReadFile(filepath.Join(dir, "logs", "06-02", entries[0].Name()))
	content := string(data)

	// First line of body should have REQ| prefix
	if !strings.Contains(content, "REQ| {\n") {
		t.Errorf("multi-line body first line should have prefix, got:\n%s", content)
	}
}

func TestErrorLogging(t *testing.T) {
	dir := t.TempDir()
	l := New(dir, true)

	ts := time.Now()
	e := l.NewEntry(ts)
	e.Request("POST", "/v1/chat/completions", http.Header{}, nil)
	e.Error("connection refused")
	e.End(502, false, 0)

	entries, _ := os.ReadDir(filepath.Join(dir, "logs", ts.Format("01-02")))
	data, _ := os.ReadFile(filepath.Join(dir, "logs", ts.Format("01-02"), entries[0].Name()))

	if !strings.Contains(string(data), "ERR| connection refused") {
		t.Error("missing ERR line")
	}
}
