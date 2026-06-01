package wire

import (
	"encoding/json"
	"testing"
)

func TestGLMMessages_Parse(t *testing.T) {
	body := []byte(`{
		"model": "glm-5.1",
		"usage": {
			"input_tokens": 161,
			"output_tokens": 64,
			"cache_read_input_tokens": 48256,
			"server_tool_use": {
				"web_search_requests": 0
			}
		}
	}`)

	r, err := GLMMessages.Parse(body)
	if err != nil {
		t.Fatal(err)
	}
	if r.Model != "glm-5.1" {
		t.Errorf("model = %q", r.Model)
	}
	if r.InputTokens != 161+48256 {
		t.Errorf("input = %d, want %d (161 + 48256)", r.InputTokens, 161+48256)
	}
	if r.OutputTokens != 64 {
		t.Errorf("output = %d, want 64", r.OutputTokens)
	}
	if r.CacheReadTokens != 48256 {
		t.Errorf("cache read = %d, want 48256", r.CacheReadTokens)
	}
}

func TestGLMMessages_Parse_WebSearch(t *testing.T) {
	body := []byte(`{
		"model": "glm-5.1",
		"usage": {
			"input_tokens": 500,
			"output_tokens": 200,
			"server_tool_use": {
				"web_search_requests": 3
			}
		}
	}`)

	r, err := GLMMessages.Parse(body)
	if err != nil {
		t.Fatal(err)
	}
	d, ok := r.Details.(AnthropicDetails)
	if !ok {
		t.Fatal("expected AnthropicDetails")
	}
	if d.WebSearchRequests != 3 {
		t.Errorf("web search = %d, want 3", d.WebSearchRequests)
	}
}

func TestGLMMessages_ParseStream(t *testing.T) {
	events := []SSEEvent{
		{Event: "message_start", Data: []byte(`{"message":{"model":"glm-5.1","usage":{"input_tokens":161,"cache_read_input_tokens":48256}}}`)},
		{Event: "content_block_delta", Data: []byte(`{"delta":{"type":"text_delta","text":"Hello"}}`)},
		{Event: "message_delta", Data: []byte(`{"usage":{"output_tokens":64}}`)},
	}

	r, err := GLMMessages.ParseStream(events)
	if err != nil {
		t.Fatal(err)
	}
	if r.Model != "glm-5.1" {
		t.Errorf("model = %q", r.Model)
	}
	if r.InputTokens != 161+48256 {
		t.Errorf("input = %d, want %d", r.InputTokens, 161+48256)
	}
	if r.OutputTokens != 64 {
		t.Errorf("output = %d, want 64", r.OutputTokens)
	}
	if r.CacheReadTokens != 48256 {
		t.Errorf("cache read = %d, want 48256", r.CacheReadTokens)
	}

	var body map[string]any
	json.Unmarshal(r.ResponseBody, &body)
	if body["content"] != "Hello" {
		t.Errorf("content = %q", body["content"])
	}
}

func TestGLMMessages_ParseStream_WebSearch(t *testing.T) {
	events := []SSEEvent{
		{Event: "message_start", Data: []byte(`{"message":{"model":"glm-5.1","usage":{"input_tokens":500}}}`)},
		{Event: "message_delta", Data: []byte(`{"usage":{"output_tokens":10,"server_tool_use":{"web_search_requests":2}}}`)},
	}

	r, err := GLMMessages.ParseStream(events)
	if err != nil {
		t.Fatal(err)
	}
	d, ok := r.Details.(AnthropicDetails)
	if !ok {
		t.Fatal("expected AnthropicDetails")
	}
	if d.WebSearchRequests != 2 {
		t.Errorf("web search = %d, want 2", d.WebSearchRequests)
	}
}

func TestGLMMessages_ModifyRequest_Passthrough(t *testing.T) {
	body := []byte(`{"model":"glm-5.1","messages":[]}`)
	result, err := GLMMessages.ModifyRequest(body)
	if err != nil {
		t.Fatal(err)
	}
	if string(result) != string(body) {
		t.Error("GLM Messages should not modify requests")
	}
}
