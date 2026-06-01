---
name: add-provider
description: Add a new LLM provider integration to llm.log. Use when the user mentions adding a provider, integrating an API, or supporting a new LLM service. Walks through API format identification, wire format creation, provider registration, and tests.
---

# Add Provider

Integrate a new LLM provider into llm.log's MITM proxy by adding wire format parsers and provider registration.

## Step 1: Gather API information

Ask the user (or research) these essentials:

1. **Provider name** — lowercase identifier (e.g. "glm", "deepseek", "mistral")
2. **API domains** — which hostnames to intercept (e.g. `api.example.com`)
3. **API format** — which existing pattern fits:
   - **Chat Completions** — `/chat/completions` endpoint, `prompt_tokens`/`completion_tokens` usage fields (OpenAI-compatible)
   - **Messages** — `/messages` endpoint, `message_start`/`message_delta` SSE events, `input_tokens`/`output_tokens` usage (Anthropic-like)
   - **Responses** — `/responses` endpoint, `response.completed` SSE event (OpenAI Responses API)
   - **Unique** — new standalone format if none of the above match
4. **Usage fields** — JSON paths for token counts in the response. Ask for a real response example (both streaming and non-streaming if possible).
5. **Provider-specific fields** — anything beyond the common `{InputTokens, OutputTokens, CacheReadTokens, CacheWriteTokens}`. If present, a new `ProviderDetails` type is needed.

If the user provides a real API response example, use it directly — it's more reliable than documentation.

## Step 2: Choose the implementation path

### Path A: Chat Completions variant (most common)

Use when the API is OpenAI-compatible with different usage field names.

**Files to modify:**
- `internal/provider/wire/chat_completions.go` — add a `usageMapper` function + package-level `var`

**Pattern:**
```go
// In chat_completions.go — add a usageMapper:
func providerNameUsage(raw json.RawMessage) ccUsage {
	var u struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		// ... provider-specific fields
	}
	json.Unmarshal(raw, &u)
	return ccUsage{
		input:  u.PromptTokens,
		output: u.CompletionTokens,
		// cacheRead:, cacheWrite:, audioInput:, audioOutput: as needed
	}
}

// Add the package-level variable:
var ProviderNameCC Format = NewCCFormat("/chat/completions", providerNameUsage)
```

If the usage fields are identical to an existing mapper (e.g. `openaiUsage`), just reuse it:
```go
var ProviderNameCC Format = NewCCFormat("/chat/completions", openaiUsage)
```

### Path B: Standalone format

Use when the API has a unique response structure (e.g. different SSE events, different JSON layout).

**Files to create:**
- `internal/provider/wire/provider_name_format.go` — new Format implementation
- `internal/provider/wire/provider_name_format_test.go` — tests

**Pattern:**
```go
package wire

import (
	"encoding/json"
	"strings"
)

// ProviderNameFormat parses the ProviderName API format.
// Spec: https://docs.example.com/api
var ProviderNameFormat Format = &providerNameFormat{}

type providerNameFormat struct{}

func (f *providerNameFormat) MatchPath(path string) bool {
	return matchPath(path, "/endpoint")
}

func (f *providerNameFormat) ModifyRequest(body []byte) ([]byte, error) {
	return body, nil // or injectStreamUsage(body) for chat-completions-like streaming
}

func (f *providerNameFormat) Parse(body []byte) (*Result, error) {
	// Parse non-streaming response JSON
}

func (f *providerNameFormat) ParseStream(events []SSEEvent) (*Result, error) {
	// Parse SSE events, accumulate content, extract usage
}
```

### Path C: Placeholder

Use when the format is planned but not yet implemented.

**Files to create:**
- `internal/provider/wire/provider_name_format.go`

**Pattern:**
```go
package wire

// ProviderNameFormat will parse ... TODO: implement.
var ProviderNameFormat Format = (*providerNameFormatStub)(nil)

type providerNameFormatStub struct{}

func (s *providerNameFormatStub) MatchPath(string) bool                          { return false }
func (s *providerNameFormatStub) ModifyRequest(b []byte) ([]byte, error)         { return b, nil }
func (s *providerNameFormatStub) Parse([]byte) (*Result, error)                  { return &Result{}, nil }
func (s *providerNameFormatStub) ParseStream([]SSEEvent) (*Result, error)        { return &Result{}, nil }
```

## Step 3: Add ProviderDetails if needed

If the provider has unique fields beyond the common token counts, add a new variant to the `ProviderDetails` sealed interface in `internal/provider/wire/wire.go`:

```go
type NewProviderDetails struct {
	// provider-specific fields
}

func (NewProviderDetails) providerDetails() {}
```

If the provider's extra fields match an existing type (e.g. same `web_search_requests` as Anthropic), reuse that type. Only create a new type when there are genuinely new fields.

After adding a new type, update:
- `internal/pricing/pricing.go` — add a `case` in the `switch` in `Cost()`
- `internal/proxy/proxy.go` — add handling in `save()` if the provider has pricing modifiers

## Step 4: Register the provider

Create `internal/provider/provider_name.go`:

```go
package provider

import "github.com/lanesket/llm.log/internal/provider/wire"

// API docs: https://docs.example.com/api

func init() { Register(&providerNameProvider{}) }

type providerNameProvider struct{}

func (p *providerNameProvider) Name() string      { return "provider-name" }
func (p *providerNameProvider) Domains() []string { return []string{"api.example.com"} }
func (p *providerNameProvider) Formats() []wire.Format {
	return []wire.Format{
		wire.ProviderNameFormat,  // most-specific first
		// wire.FallbackFormat,   // last = default fallback
	}
}
```

**Key rules:**
- `Name()` — lowercase, used in logs and storage. This becomes `provider` column in DB.
- `Domains()` — hostnames the proxy intercepts (without port).
- `Formats()` — ordered list, most-specific first. Last entry is the default fallback. First `MatchPath` hit wins.
- `init()` — calls `Register()`, which maps each domain to this provider.

## Step 5: Write tests

For each new format, create `internal/provider/wire/provider_name_format_test.go`.

**Test cases to cover:**
1. Non-streaming parse — basic token counts
2. Non-streaming parse — provider-specific fields (cache, web search, etc.)
3. Streaming parse — content accumulation + usage from final event
4. Streaming parse — provider-specific fields from stream
5. ModifyRequest — passthrough or injection behavior

Use real API response examples from the user when available. Use the standard test patterns from existing test files.

## Step 6: Build and verify

```bash
go build ./...
go test ./internal/provider/... ./internal/provider/wire/...
```

## Key conventions

- **File naming**: `snake_case.go` matching the format name (e.g. `glm_messages.go`)
- **Tab indentation** throughout the codebase
- **InputTokens semantics** varies by provider:
  - OpenAI/Chat Completions: `prompt_tokens` = total (includes cached)
  - Anthropic/GLM Messages: `input_tokens` = uncached only; must add cache tokens manually
- **Details field**: set only when provider-specific data exists; leave `nil` otherwise
- **Streaming**: always call `reconstructStreamBody(model, content)` at the end of `ParseStream`
- **Usage mapper returns zeros** for missing/invalid input — callers handle empty results gracefully

## Reference

- Existing formats: `chat_completions.go`, `anthropic_messages.go`, `glm_messages.go`, `responses.go`
- Provider examples: `openai.go`, `anthropic.go`, `glm.go`, `deepseek.go`, `openrouter.go`
- Pricing integration: `internal/pricing/pricing.go` `Cost()` method
- Proxy integration: `internal/proxy/proxy.go` `save()` method
- ProviderDetails: `internal/provider/wire/wire.go`
