package wire

import (
	"encoding/json"
	"strings"
)

// ChatCompletions parses the OpenAI Chat Completions format.
// Used by: OpenAI (/v1/chat/completions), OpenRouter, and any OpenAI-compatible API.
// Spec: https://platform.openai.com/docs/api-reference/chat/create
var ChatCompletions Format = NewCCFormat("/chat/completions", openaiUsage)

// DeepSeekChatCompletions extends Chat Completions with DeepSeek-specific
// cache token fields (prompt_cache_hit_tokens instead of prompt_tokens_details.cached_tokens).
// Spec: https://api-docs.deepseek.com/api/create-chat-completion
var DeepSeekChatCompletions Format = NewCCFormat("/chat/completions", deepseekUsage)

// PerplexitySonar parses the Perplexity Sonar API format.
// Structurally identical to Chat Completions but uses /sonar endpoint path.
// Spec: https://docs.perplexity.ai/api-reference/sonar-post
var PerplexitySonar Format = NewCCFormat("/sonar", openaiUsage)

// GLMChatCompletions parses the GLM Chat Completions format.
// Used by: Zhipu/GLM (智谱). Uses standard OpenAI usage fields
// (prompt_tokens_details.cached_tokens, completion_tokens_details.reasoning_tokens).
// Spec: https://open.bigmodel.cn/dev/api
var GLMChatCompletions Format = NewCCFormat("/chat/completions", openaiUsage)

// NewCCFormat creates a Chat Completions-compatible Format with a custom
// path suffix and usage mapper. This is the extension point for adding
// new providers that use Chat Completions with different usage fields.
func NewCCFormat(pathSuffix string, mapUsage usageMapper) Format {
	return &ccFormat{pathSuffix: pathSuffix, mapUsage: mapUsage}
}

type ccFormat struct {
	pathSuffix string
	mapUsage   usageMapper
}

func (f *ccFormat) MatchPath(path string) bool {
	return matchPath(path, f.pathSuffix)
}

func (f *ccFormat) ModifyRequest(body []byte) ([]byte, error) {
	return injectStreamUsage(body)
}

func (f *ccFormat) Parse(body []byte) (*Result, error) {
	return parseCCResponse(body, f.mapUsage)
}

func (f *ccFormat) ParseStream(events []SSEEvent) (*Result, error) {
	return parseCCStream(events, f.mapUsage)
}

// ccUsage holds parsed token counts from a Chat Completions usage object.
type ccUsage struct {
	input, output, cacheRead, cacheWrite int
	audioInput, audioOutput              int
}

// usageMapper extracts token counts from a raw usage JSON object.
// Each wire format provides its own mapper to handle provider-specific field names.
// Returns zeros for nil/invalid input — callers handle empty results.
type usageMapper func(raw json.RawMessage) ccUsage

// openaiUsage maps the standard OpenAI usage fields.
func openaiUsage(raw json.RawMessage) ccUsage {
	var u struct {
		PromptTokens        int `json:"prompt_tokens"`
		CompletionTokens    int `json:"completion_tokens"`
		PromptTokensDetails struct {
			CachedTokens int `json:"cached_tokens"`
			AudioTokens  int `json:"audio_tokens"`
		} `json:"prompt_tokens_details"`
		CompletionTokensDetails struct {
			AudioTokens int `json:"audio_tokens"`
		} `json:"completion_tokens_details"`
	}
	json.Unmarshal(raw, &u)
	return ccUsage{
		input:       u.PromptTokens,
		output:      u.CompletionTokens,
		cacheRead:   u.PromptTokensDetails.CachedTokens,
		audioInput:  u.PromptTokensDetails.AudioTokens,
		audioOutput: u.CompletionTokensDetails.AudioTokens,
	}
}

// deepseekUsage maps DeepSeek's cache fields (prompt_cache_hit_tokens).
func deepseekUsage(raw json.RawMessage) ccUsage {
	var u struct {
		PromptTokens         int `json:"prompt_tokens"`
		CompletionTokens     int `json:"completion_tokens"`
		PromptCacheHitTokens int `json:"prompt_cache_hit_tokens"`
	}
	json.Unmarshal(raw, &u)
	return ccUsage{
		input:     u.PromptTokens,
		output:    u.CompletionTokens,
		cacheRead: u.PromptCacheHitTokens,
	}
}

// parseCCResponse parses a non-streaming Chat Completions-style response.
func parseCCResponse(body []byte, mapUsage usageMapper) (*Result, error) {
	var resp struct {
		Model string          `json:"model"`
		Usage json.RawMessage `json:"usage"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}
	u := mapUsage(resp.Usage)
	r := &Result{
		Model:            resp.Model,
		InputTokens:      u.input,
		OutputTokens:     u.output,
		CacheReadTokens:  u.cacheRead,
		CacheWriteTokens: u.cacheWrite,
		ResponseBody:     body,
	}
	if u.audioInput > 0 || u.audioOutput > 0 {
		r.Details = OpenAIDetails{
			AudioInputTokens:  u.audioInput,
			AudioOutputTokens: u.audioOutput,
		}
	}
	return r, nil
}

// parseCCStream parses a streaming Chat Completions-style response.
func parseCCStream(events []SSEEvent, mapUsage usageMapper) (*Result, error) {
	var result Result
	var content strings.Builder
	var chunk struct {
		Model   string `json:"model"`
		Choices []struct {
			Delta struct {
				Content string `json:"content"`
			} `json:"delta"`
		} `json:"choices"`
		Usage json.RawMessage `json:"usage"`
	}

	for _, ev := range events {
		if string(ev.Data) == "[DONE]" {
			continue
		}
		chunk.Model = ""
		chunk.Choices = chunk.Choices[:0]
		chunk.Usage = chunk.Usage[:0]
		if json.Unmarshal(ev.Data, &chunk) != nil {
			continue
		}
		if result.Model == "" && chunk.Model != "" {
			result.Model = chunk.Model
		}
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			content.WriteString(chunk.Choices[0].Delta.Content)
		}
		if len(chunk.Usage) > 0 {
			u := mapUsage(chunk.Usage)
			if u.input > 0 || u.output > 0 {
				result.InputTokens = u.input
				result.OutputTokens = u.output
				result.CacheReadTokens = u.cacheRead
				result.CacheWriteTokens = u.cacheWrite
				if u.audioInput > 0 || u.audioOutput > 0 {
					result.Details = OpenAIDetails{
						AudioInputTokens:  u.audioInput,
						AudioOutputTokens: u.audioOutput,
					}
				}
			}
		}
	}

	result.ResponseBody = reconstructStreamBody(result.Model, content.String())
	return &result, nil
}

// NewCCFormatFromFields creates a Chat Completions Format with a dynamic
// usageMapper built from user-configured field mappings.
// Keys are logical names (input, output, cache_read, cache_write, audio_input,
// audio_output); values are dot-separated JSON paths within the usage object.
func NewCCFormatFromFields(pathSuffix string, fields map[string]string) Format {
	return NewCCFormat(pathSuffix, dynamicUsage(fields))
}

// dynamicUsage builds a usageMapper from a field→path mapping.
// Dot-separated paths walk nested JSON objects (e.g. "prompt_tokens_details.cached_tokens").
// Missing paths default to 0, matching existing usageMapper behavior.
func dynamicUsage(fields map[string]string) usageMapper {
	return func(raw json.RawMessage) ccUsage {
		// Parse the usage object into a generic map for path walking.
		var obj map[string]any
		if json.Unmarshal(raw, &obj) != nil {
			return ccUsage{}
		}
		return ccUsage{
			input:       jsonInt(walkPath(obj, fields["input"])),
			output:      jsonInt(walkPath(obj, fields["output"])),
			cacheRead:   jsonInt(walkPath(obj, fields["cache_read"])),
			cacheWrite:  jsonInt(walkPath(obj, fields["cache_write"])),
			audioInput:  jsonInt(walkPath(obj, fields["audio_input"])),
			audioOutput: jsonInt(walkPath(obj, fields["audio_output"])),
		}
	}
}

// walkPath traverses a nested map by dot-separated path (e.g. "a.b.c").
// Returns nil if any segment is missing or not a map.
func walkPath(obj map[string]any, path string) any {
	if path == "" {
		return nil
	}
	parts := strings.Split(path, ".")
	var cur any = obj
	for _, p := range parts {
		m, ok := cur.(map[string]any)
		if !ok {
			return nil
		}
		cur = m[p]
		if cur == nil {
			return nil
		}
	}
	return cur
}

// jsonInt converts a JSON number (float64 from encoding/json) to int.
func jsonInt(v any) int {
	if v == nil {
		return 0
	}
	f, ok := v.(float64)
	if !ok {
		return 0
	}
	return int(f)
}

// injectStreamUsage adds stream_options.include_usage to streaming requests.
// Shared by all Chat Completions-compatible formats.
func injectStreamUsage(body []byte) ([]byte, error) {
	var req map[string]any
	if err := json.Unmarshal(body, &req); err != nil {
		return body, nil
	}
	if stream, ok := req["stream"].(bool); !ok || !stream {
		return body, nil
	}
	opts, _ := req["stream_options"].(map[string]any)
	if opts == nil {
		opts = map[string]any{}
	}
	opts["include_usage"] = true
	req["stream_options"] = opts
	modified, err := json.Marshal(req)
	if err != nil {
		return body, nil
	}
	return modified, nil
}
