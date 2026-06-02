package wire

import (
	"encoding/json"
	"strings"
)

// AnthropicMessages parses the Anthropic Messages API format.
// Used by: Anthropic (/v1/messages), OpenRouter.
// Anthropic reports input_tokens as the uncached portion only,
// so total = input_tokens + cache_read + cache_creation.
// Spec: https://platform.claude.com/docs/en/api/messages
var AnthropicMessages Format = &anthropicMessages{}

type anthropicMessages struct{}

func (a *anthropicMessages) MatchPath(path string) bool {
	return matchPath(path, "/messages")
}

func (a *anthropicMessages) ModifyRequest(body []byte) ([]byte, error) {
	return body, nil
}

func (a *anthropicMessages) Parse(body []byte) (*Result, error) {
	var resp struct {
		Model string `json:"model"`
		Usage struct {
			InputTokens              int    `json:"input_tokens"`
			OutputTokens             int    `json:"output_tokens"`
			CacheReadInputTokens     int    `json:"cache_read_input_tokens"`
			CacheCreationInputTokens int    `json:"cache_creation_input_tokens"`
			Speed                    string `json:"speed"`
			ServerToolUse            struct {
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
		InputTokens:      u.InputTokens + u.CacheReadInputTokens + u.CacheCreationInputTokens,
		OutputTokens:     u.OutputTokens,
		CacheReadTokens:  u.CacheReadInputTokens,
		CacheWriteTokens: u.CacheCreationInputTokens,
		Details: AnthropicDetails{
			WebSearchRequests: u.ServerToolUse.WebSearchRequests,
			FastMode:          u.Speed == "fast",
		},
		ResponseBody: body,
	}, nil
}

// anthropicContentBlock tracks an in-progress content block during streaming.
type anthropicContentBlock struct {
	blockType string // "text", "thinking", "tool_use"
	text      strings.Builder
	// tool_use fields
	toolID   string
	toolName string
	toolJSON strings.Builder
}

// ParseStream extracts usage and full content (text, thinking, tool_use)
// from accumulated SSE events.
// Anthropic sends:
//   - message_start       → model, input_tokens, cache tokens
//   - content_block_start → block type (text/thinking/tool_use), tool id+name
//   - content_block_delta → text_delta, thinking_delta, or input_json_delta
//   - content_block_stop  → end of current block
//   - message_delta       → output_tokens, speed
func (a *anthropicMessages) ParseStream(events []SSEEvent) (*Result, error) {
	var result Result
	var details AnthropicDetails

	// Track content blocks as they arrive.
	var blocks []anthropicContentBlock
	var current *anthropicContentBlock

	for _, ev := range events {
		switch ev.Event {
		case "message_start":
			var msg struct {
				Message struct {
					Model string `json:"model"`
					Usage struct {
						InputTokens              int    `json:"input_tokens"`
						CacheReadInputTokens     int    `json:"cache_read_input_tokens"`
						CacheCreationInputTokens int    `json:"cache_creation_input_tokens"`
						Speed                    string `json:"speed"`
					} `json:"usage"`
				} `json:"message"`
			}
			if json.Unmarshal(ev.Data, &msg) == nil {
				u := msg.Message.Usage
				result.Model = msg.Message.Model
				result.CacheReadTokens = u.CacheReadInputTokens
				result.CacheWriteTokens = u.CacheCreationInputTokens
				result.InputTokens = u.InputTokens + u.CacheReadInputTokens + u.CacheCreationInputTokens
				if u.Speed == "fast" {
					details.FastMode = true
				}
			}

		case "content_block_start":
			var start struct {
				ContentBlock struct {
					Type string `json:"type"`
					ID   string `json:"id"`
					Name string `json:"name"`
				} `json:"content_block"`
			}
			if json.Unmarshal(ev.Data, &start) == nil {
				blocks = append(blocks, anthropicContentBlock{
					blockType: start.ContentBlock.Type,
					toolID:    start.ContentBlock.ID,
					toolName:  start.ContentBlock.Name,
				})
				current = &blocks[len(blocks)-1]
			}

		case "content_block_delta":
			if current == nil {
				continue
			}
			var delta struct {
				Delta struct {
					Type        string `json:"type"`
					Text        string `json:"text"`
					Thinking    string `json:"thinking"`
					PartialJSON string `json:"partial_json"`
				} `json:"delta"`
			}
			if json.Unmarshal(ev.Data, &delta) != nil {
				continue
			}
			switch delta.Delta.Type {
			case "text_delta":
				current.text.WriteString(delta.Delta.Text)
			case "thinking_delta":
				current.text.WriteString(delta.Delta.Thinking)
			case "input_json_delta":
				current.toolJSON.WriteString(delta.Delta.PartialJSON)
			}

		case "content_block_stop":
			current = nil

		case "message_delta":
			var delta struct {
				Usage struct {
					OutputTokens  int    `json:"output_tokens"`
					Speed         string `json:"speed"`
					ServerToolUse struct {
						WebSearchRequests int `json:"web_search_requests"`
					} `json:"server_tool_use"`
				} `json:"usage"`
			}
			if json.Unmarshal(ev.Data, &delta) == nil {
				result.OutputTokens = delta.Usage.OutputTokens
				if delta.Usage.Speed == "fast" {
					details.FastMode = true
				}
				if delta.Usage.ServerToolUse.WebSearchRequests > 0 {
					details.WebSearchRequests = delta.Usage.ServerToolUse.WebSearchRequests
				}
			}
		}
	}

	result.ResponseBody = reconstructAnthropicStreamBody(result.Model, blocks)
	if details != (AnthropicDetails{}) {
		result.Details = details
	}
	return &result, nil
}

// reconstructAnthropicStreamBody builds a JSON response body that the
// frontend parser (parseAnthropicResponseContent) can consume.
// Produces {"model":"...","content":[...]} with typed content blocks.
func reconstructAnthropicStreamBody(model string, blocks []anthropicContentBlock) []byte {
	type contentBlock struct {
		Type  string          `json:"type"`
		Text  string          `json:"text,omitempty"`
		ID    string          `json:"id,omitempty"`
		Name  string          `json:"name,omitempty"`
		Input json.RawMessage `json:"input,omitempty"`
	}

	content := make([]contentBlock, 0, len(blocks))
	for _, b := range blocks {
		switch b.blockType {
		case "text":
			text := b.text.String()
			if text == "" {
				continue
			}
			content = append(content, contentBlock{Type: "text", Text: text})
		case "thinking":
			content = append(content, contentBlock{Type: "thinking", Text: b.text.String()})
		case "tool_use":
			var input json.RawMessage = json.RawMessage("{}")
			if raw := b.toolJSON.String(); raw != "" {
				// Validate JSON; fall back to raw string if invalid.
				if json.Valid([]byte(raw)) {
					input = json.RawMessage(raw)
				}
			}
			content = append(content, contentBlock{
				Type:  "tool_use",
				ID:    b.toolID,
				Name:  b.toolName,
				Input: input,
			})
		}
	}

	// If no blocks were captured, fall back to empty content string
	// for backward compatibility.
	if len(content) == 0 {
		b, _ := json.Marshal(map[string]any{"model": model, "content": ""})
		return b
	}

	body := struct {
		Model   string         `json:"model"`
		Content []contentBlock `json:"content"`
	}{
		Model:   model,
		Content: content,
	}
	b, _ := json.Marshal(body)
	return b
}
