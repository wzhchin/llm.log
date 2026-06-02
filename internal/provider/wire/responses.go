package wire

import (
	"encoding/json"
	"strings"
)

// Responses parses the OpenAI Responses API format.
// Used by: OpenAI (/v1/responses), OpenRouter.
// Streaming uses response.output_text.delta for content and
// response.completed for the final response with usage.
// Spec: https://platform.openai.com/docs/api-reference/responses/create
var Responses Format = &responsesFormat{}

type responsesFormat struct{}

func (r *responsesFormat) MatchPath(path string) bool {
	return matchPath(path, "/responses")
}

// ModifyRequest — Responses API includes usage in response.completed by default.
func (r *responsesFormat) ModifyRequest(body []byte) ([]byte, error) {
	return body, nil
}

func (r *responsesFormat) Parse(body []byte) (*Result, error) {
	var resp responsesResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}
	result := &Result{
		Model:           resp.Model,
		InputTokens:     resp.Usage.InputTokens,
		OutputTokens:    resp.Usage.OutputTokens,
		CacheReadTokens: resp.Usage.InputTokenDetails.CachedTokens,
		ResponseBody:    body,
	}
	if resp.Usage.InputTokenDetails.AudioTokens > 0 || resp.Usage.OutputTokenDetails.AudioTokens > 0 {
		result.Details = OpenAIDetails{
			AudioInputTokens:  resp.Usage.InputTokenDetails.AudioTokens,
			AudioOutputTokens: resp.Usage.OutputTokenDetails.AudioTokens,
		}
	}
	return result, nil
}

// responsesFunctionCall tracks an in-progress function call during streaming.
type responsesFunctionCall struct {
	callID    string
	name      string
	arguments strings.Builder
}

func (r *responsesFormat) ParseStream(events []SSEEvent) (*Result, error) {
	var result Result
	var content strings.Builder
	var funcCalls []responsesFunctionCall

	for _, ev := range events {
		switch ev.Event {
		case "response.output_text.delta":
			var delta struct {
				Delta string `json:"delta"`
			}
			if json.Unmarshal(ev.Data, &delta) == nil {
				content.WriteString(delta.Delta)
			}

		case "response.output_item.added":
			var added struct {
				Item struct {
					Type   string `json:"type"`
					CallID string `json:"call_id"`
					Name   string `json:"name"`
				} `json:"item"`
			}
			if json.Unmarshal(ev.Data, &added) == nil && added.Item.Type == "function_call" {
				funcCalls = append(funcCalls, responsesFunctionCall{
					callID: added.Item.CallID,
					name:   added.Item.Name,
				})
			}

		case "response.function_call_arguments.delta":
			var delta struct {
				Delta string `json:"delta"`
			}
			if json.Unmarshal(ev.Data, &delta) == nil && len(funcCalls) > 0 {
				funcCalls[len(funcCalls)-1].arguments.WriteString(delta.Delta)
			}

		case "response.completed":
			var completed struct {
				Response struct {
					Model string         `json:"model"`
					Usage responsesUsage `json:"usage"`
				} `json:"response"`
			}
			if json.Unmarshal(ev.Data, &completed) == nil {
				u := completed.Response.Usage
				result.Model = completed.Response.Model
				result.InputTokens = u.InputTokens
				result.OutputTokens = u.OutputTokens
				result.CacheReadTokens = u.InputTokenDetails.CachedTokens
				if u.InputTokenDetails.AudioTokens > 0 || u.OutputTokenDetails.AudioTokens > 0 {
					result.Details = OpenAIDetails{
						AudioInputTokens:  u.InputTokenDetails.AudioTokens,
						AudioOutputTokens: u.OutputTokenDetails.AudioTokens,
					}
				}
			}
		}
	}

	result.ResponseBody = reconstructResponsesStreamBody(result.Model, content.String(), funcCalls)
	return &result, nil
}

// reconstructResponsesStreamBody builds a JSON response body that the frontend
// parser (parseResponsesOutput) can consume.
// If function calls are present, produces {"model":"...","output":[...]}.
// Otherwise falls back to {"model":"...","content":"..."} for backward compatibility.
func reconstructResponsesStreamBody(model, textContent string, funcCalls []responsesFunctionCall) []byte {
	// If no function calls, use the simple format.
	if len(funcCalls) == 0 {
		b, _ := json.Marshal(map[string]any{"model": model, "content": textContent})
		return b
	}

	type outputItem struct {
		Type      string `json:"type"`
		CallID    string `json:"call_id,omitempty"`
		Name      string `json:"name,omitempty"`
		Arguments string `json:"arguments,omitempty"`
		Role      string `json:"role,omitempty"`
		Content   any    `json:"content,omitempty"`
	}

	output := make([]outputItem, 0, len(funcCalls)+1)

	// Add text as a message output item if present.
	if textContent != "" {
		output = append(output, outputItem{
			Type:    "message",
			Role:    "assistant",
			Content: []any{map[string]any{"type": "output_text", "text": textContent}},
		})
	}

	// Add function calls.
	for _, fc := range funcCalls {
		output = append(output, outputItem{
			Type:      "function_call",
			CallID:    fc.callID,
			Name:      fc.name,
			Arguments: fc.arguments.String(),
		})
	}

	body := struct {
		Model  string       `json:"model"`
		Output []outputItem `json:"output"`
	}{
		Model:  model,
		Output: output,
	}
	b, _ := json.Marshal(body)
	return b
}

type responsesUsage struct {
	InputTokens       int `json:"input_tokens"`
	OutputTokens      int `json:"output_tokens"`
	InputTokenDetails struct {
		CachedTokens int `json:"cached_tokens"`
		AudioTokens  int `json:"audio_tokens"`
	} `json:"input_token_details"`
	OutputTokenDetails struct {
		AudioTokens int `json:"audio_tokens"`
	} `json:"output_token_details"`
}

type responsesResponse struct {
	Model string         `json:"model"`
	Usage responsesUsage `json:"usage"`
}
