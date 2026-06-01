package wire

import (
	"encoding/json"
	"strings"
)

// GLMMessages parses the GLM Messages API format.
// Used by: Zhipu/GLM (智谱).
// Structurally similar to Anthropic Messages with message_start/content_block_delta/message_delta
// SSE events. Reports input_tokens as the uncached portion only, plus cache_read_input_tokens.
// Spec: https://open.bigmodel.cn/dev/api
var GLMMessages Format = &glmMessages{}

type glmMessages struct{}

func (g *glmMessages) MatchPath(path string) bool {
	return matchPath(path, "/messages")
}

func (g *glmMessages) ModifyRequest(body []byte) ([]byte, error) {
	return body, nil
}

func (g *glmMessages) Parse(body []byte) (*Result, error) {
	var resp struct {
		Model string `json:"model"`
		Usage struct {
			InputTokens          int `json:"input_tokens"`
			OutputTokens         int `json:"output_tokens"`
			CacheReadInputTokens int `json:"cache_read_input_tokens"`
			ServerToolUse        struct {
				WebSearchRequests int `json:"web_search_requests"`
			} `json:"server_tool_use"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}
	u := resp.Usage
	return &Result{
		Model:            resp.Model,
		InputTokens:      u.InputTokens + u.CacheReadInputTokens,
		OutputTokens:     u.OutputTokens,
		CacheReadTokens:  u.CacheReadInputTokens,
		Details:          buildGLMDetails(u.ServerToolUse.WebSearchRequests),
		ResponseBody:     body,
	}, nil
}

func (g *glmMessages) ParseStream(events []SSEEvent) (*Result, error) {
	var result Result
	var content strings.Builder
	var webSearches int

	for _, ev := range events {
		switch ev.Event {
		case "message_start":
			var msg struct {
				Message struct {
					Model string `json:"model"`
				} `json:"message"`
			}
			if json.Unmarshal(ev.Data, &msg) == nil {
				result.Model = msg.Message.Model
			}

		case "content_block_delta":
			var delta struct {
				Delta struct {
					Type string `json:"type"`
					Text string `json:"text"`
				} `json:"delta"`
			}
			if json.Unmarshal(ev.Data, &delta) == nil && delta.Delta.Type == "text_delta" {
				content.WriteString(delta.Delta.Text)
			}

		case "message_delta":
			var delta struct {
				Usage struct {
					InputTokens          int `json:"input_tokens"`
					OutputTokens         int `json:"output_tokens"`
					CacheReadInputTokens int `json:"cache_read_input_tokens"`
					ServerToolUse        struct {
						WebSearchRequests int `json:"web_search_requests"`
					} `json:"server_tool_use"`
				} `json:"usage"`
			}
			if json.Unmarshal(ev.Data, &delta) == nil {
				u := delta.Usage
				result.OutputTokens = u.OutputTokens
				if u.CacheReadInputTokens > 0 {
					result.CacheReadTokens = u.CacheReadInputTokens
				}
				if u.InputTokens > 0 {
					result.InputTokens = u.InputTokens + u.CacheReadInputTokens
				}
				if u.ServerToolUse.WebSearchRequests > 0 {
					webSearches = u.ServerToolUse.WebSearchRequests
				}
			}
		}
	}

	result.ResponseBody = reconstructStreamBody(result.Model, content.String())
	if webSearches > 0 {
		result.Details = AnthropicDetails{WebSearchRequests: webSearches}
	}
	return &result, nil
}

// buildGLMDetails creates AnthropicDetails for GLM if there's provider-specific data.
// GLM shares the same web_search_requests field as Anthropic.
func buildGLMDetails(webSearchRequests int) AnthropicDetails {
	return AnthropicDetails{WebSearchRequests: webSearchRequests}
}
