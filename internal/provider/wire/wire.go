// Package wire implements parsers for LLM API wire formats.
//
// Each format (Chat Completions, Responses API, Anthropic Messages, etc.)
// is implemented once and reused across providers.
package wire

import (
	"strings"
)

// Format handles parsing for a specific LLM API wire format.
type Format interface {
	MatchPath(path string) bool
	ModifyRequest(body []byte) ([]byte, error)
	Parse(body []byte) (*Result, error)
	ParseStream(events []SSEEvent) (*Result, error)
}

// ProviderDetails holds provider-specific usage details.
// Use a type switch to extract provider-specific data:
//
//	switch d := result.Details.(type) {
//	case wire.OpenAIDetails:
//	    // d.AudioInputTokens, d.AudioOutputTokens
//	case wire.AnthropicDetails:
//	    // d.WebSearchRequests, d.FastMode
//	}
type ProviderDetails interface {
	providerDetails() // sealed: only implementations in this package
}

// OpenAIDetails holds OpenAI-specific usage data.
// AudioInputTokens and AudioOutputTokens are subsets of InputTokens and
// OutputTokens that were audio. Priced at a different rate.
type OpenAIDetails struct {
	AudioInputTokens  int
	AudioOutputTokens int
}

func (OpenAIDetails) providerDetails() {}

// AnthropicDetails holds Anthropic-specific usage data.
type AnthropicDetails struct {
	// WebSearchRequests is the number of server-side web searches performed.
	// Billed at a flat per-search rate.
	WebSearchRequests int

	// FastMode indicates the response was served in fast mode (6x pricing).
	// Detected from usage.speed == "fast" in the API response.
	// Ref: https://platform.claude.com/docs/en/build-with-claude/fast-mode
	FastMode bool
}

func (AnthropicDetails) providerDetails() {}

// Result holds parsed usage data from an API response.
// InputTokens is the total input tokens INCLUDING all cache tokens.
type Result struct {
	Model            string
	InputTokens      int // total: uncached + cache read + cache write
	OutputTokens     int
	CacheReadTokens  int
	CacheWriteTokens int
	Details          ProviderDetails // nil for providers without extras
	ResponseBody     []byte
}

// SSEEvent is a single server-sent event from a streaming response.
type SSEEvent struct {
	Event string
	Data  []byte
}

func matchPath(path, suffix string) bool {
	return strings.HasSuffix(path, suffix) || strings.Contains(path, suffix+"/")
}
