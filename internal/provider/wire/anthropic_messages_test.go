package wire

import (
	"encoding/json"
	"testing"
)

func TestAnthropicMessages_Parse(t *testing.T) {
	body := []byte(`{
		"model": "claude-sonnet-4-6",
		"usage": {
			"input_tokens": 80,
			"output_tokens": 50,
			"cache_read_input_tokens": 20,
			"cache_creation_input_tokens": 10
		}
	}`)

	r, err := AnthropicMessages.Parse(body)
	if err != nil {
		t.Fatal(err)
	}
	if r.Model != "claude-sonnet-4-6" {
		t.Errorf("model = %q", r.Model)
	}
	if r.InputTokens != 110 {
		t.Errorf("input = %d, want 110 (80 uncached + 20 read + 10 write)", r.InputTokens)
	}
	if r.OutputTokens != 50 {
		t.Errorf("output = %d, want 50", r.OutputTokens)
	}
	if r.CacheReadTokens != 20 {
		t.Errorf("cache read = %d, want 20", r.CacheReadTokens)
	}
	if r.CacheWriteTokens != 10 {
		t.Errorf("cache write = %d, want 10", r.CacheWriteTokens)
	}
}

func TestAnthropicMessages_Parse_NoCaching(t *testing.T) {
	body := []byte(`{"model":"claude-haiku-4-5","usage":{"input_tokens":50,"output_tokens":30}}`)
	r, err := AnthropicMessages.Parse(body)
	if err != nil {
		t.Fatal(err)
	}
	if r.InputTokens != 50 {
		t.Errorf("input = %d, want 50", r.InputTokens)
	}
	if r.CacheReadTokens != 0 || r.CacheWriteTokens != 0 {
		t.Errorf("cache = %d/%d, want 0/0", r.CacheReadTokens, r.CacheWriteTokens)
	}
}

func TestAnthropicMessages_Parse_FastMode(t *testing.T) {
	body := []byte(`{
		"model": "claude-opus-4-6",
		"usage": {
			"input_tokens": 100,
			"output_tokens": 50,
			"speed": "fast"
		}
	}`)

	r, err := AnthropicMessages.Parse(body)
	if err != nil {
		t.Fatal(err)
	}
	d, ok := r.Details.(AnthropicDetails)
	if !ok || !d.FastMode {
		t.Error("FastMode should be true when speed=fast")
	}
}

func TestAnthropicMessages_Parse_StandardSpeed(t *testing.T) {
	body := []byte(`{
		"model": "claude-opus-4-6",
		"usage": {
			"input_tokens": 100,
			"output_tokens": 50,
			"speed": "standard"
		}
	}`)

	r, err := AnthropicMessages.Parse(body)
	if err != nil {
		t.Fatal(err)
	}
	if d, ok := r.Details.(AnthropicDetails); ok && d.FastMode {
		t.Error("FastMode should be false when speed=standard")
	}
}

func TestAnthropicMessages_Parse_WebSearch(t *testing.T) {
	body := []byte(`{
		"model": "claude-sonnet-4-6",
		"usage": {
			"input_tokens": 500,
			"output_tokens": 200,
			"server_tool_use": {
				"web_search_requests": 3
			}
		}
	}`)

	r, err := AnthropicMessages.Parse(body)
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
	if r.InputTokens != 500 {
		t.Errorf("input = %d, want 500", r.InputTokens)
	}
}

func TestAnthropicMessages_ParseStream(t *testing.T) {
	events := []SSEEvent{
		{Event: "message_start", Data: []byte(`{"message":{"model":"claude-sonnet-4-6","usage":{"input_tokens":80,"cache_read_input_tokens":20,"cache_creation_input_tokens":5}}}`)},
		{Event: "content_block_start", Data: []byte(`{"content_block":{"type":"text"}}`)},
		{Event: "content_block_delta", Data: []byte(`{"delta":{"type":"text_delta","text":"Hello"}}`)},
		{Event: "content_block_delta", Data: []byte(`{"delta":{"type":"text_delta","text":" world"}}`)},
		{Event: "content_block_stop", Data: []byte(`{}`)},
		{Event: "message_delta", Data: []byte(`{"usage":{"output_tokens":2}}`)},
	}

	r, err := AnthropicMessages.ParseStream(events)
	if err != nil {
		t.Fatal(err)
	}
	if r.Model != "claude-sonnet-4-6" {
		t.Errorf("model = %q", r.Model)
	}
	if r.InputTokens != 105 {
		t.Errorf("input = %d, want 105 (80 + 20 + 5)", r.InputTokens)
	}
	if r.OutputTokens != 2 {
		t.Errorf("output = %d, want 2", r.OutputTokens)
	}
	if r.CacheReadTokens != 20 {
		t.Errorf("cache read = %d, want 20", r.CacheReadTokens)
	}
	if r.CacheWriteTokens != 5 {
		t.Errorf("cache write = %d, want 5", r.CacheWriteTokens)
	}

	var body struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	json.Unmarshal(r.ResponseBody, &body)
	if len(body.Content) != 1 || body.Content[0].Text != "Hello world" {
		t.Errorf("content = %+v", body.Content)
	}
}

func TestAnthropicMessages_ParseStream_WebSearch(t *testing.T) {
	events := []SSEEvent{
		{Event: "message_start", Data: []byte(`{"message":{"model":"claude-sonnet-4-6","usage":{"input_tokens":500}}}`)},
		{Event: "content_block_delta", Data: []byte(`{"delta":{"type":"text_delta","text":"Result"}}`)},
		{Event: "message_delta", Data: []byte(`{"usage":{"output_tokens":10,"server_tool_use":{"web_search_requests":2}}}`)},
	}

	r, err := AnthropicMessages.ParseStream(events)
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
	if r.OutputTokens != 10 {
		t.Errorf("output = %d, want 10", r.OutputTokens)
	}
}

func TestAnthropicMessages_ParseStream_FastMode_MessageDelta(t *testing.T) {
	events := []SSEEvent{
		{Event: "message_start", Data: []byte(`{"message":{"model":"claude-opus-4-6","usage":{"input_tokens":100}}}`)},
		{Event: "message_delta", Data: []byte(`{"usage":{"output_tokens":5,"speed":"fast"}}`)},
	}

	r, err := AnthropicMessages.ParseStream(events)
	if err != nil {
		t.Fatal(err)
	}
	d, ok := r.Details.(AnthropicDetails)
	if !ok || !d.FastMode {
		t.Error("FastMode should be true when speed=fast in message_delta")
	}
}

func TestAnthropicMessages_ParseStream_FastMode_MessageStart(t *testing.T) {
	// speed may appear in message_start instead of (or in addition to) message_delta
	events := []SSEEvent{
		{Event: "message_start", Data: []byte(`{"message":{"model":"claude-opus-4-6","usage":{"input_tokens":100,"speed":"fast"}}}`)},
		{Event: "message_delta", Data: []byte(`{"usage":{"output_tokens":5}}`)},
	}

	r, err := AnthropicMessages.ParseStream(events)
	if err != nil {
		t.Fatal(err)
	}
	d, ok := r.Details.(AnthropicDetails)
	if !ok || !d.FastMode {
		t.Error("FastMode should be true when speed=fast in message_start")
	}
}

func TestAnthropicMessages_ParseStream_ToolUseOnly(t *testing.T) {
	// Response with only tool calls, no text — the original bug scenario.
	events := []SSEEvent{
		{Event: "message_start", Data: []byte(`{"message":{"model":"claude-sonnet-4-6","usage":{"input_tokens":100}}}`)},
		{Event: "content_block_start", Data: []byte(`{"content_block":{"type":"tool_use","id":"toolu_01","name":"read_file"}}`)},
		{Event: "content_block_delta", Data: []byte(`{"delta":{"type":"input_json_delta","partial_json":"{\"path\":\"/tmp/test\"}"}}`)},
		{Event: "content_block_stop", Data: []byte(`{}`)},
		{Event: "message_delta", Data: []byte(`{"usage":{"output_tokens":50}}`)},
	}

	r, err := AnthropicMessages.ParseStream(events)
	if err != nil {
		t.Fatal(err)
	}
	if r.Model != "claude-sonnet-4-6" {
		t.Errorf("model = %q", r.Model)
	}
	if r.OutputTokens != 50 {
		t.Errorf("output = %d, want 50", r.OutputTokens)
	}

	var body struct {
		Content []struct {
			Type  string          `json:"type"`
			ID    string          `json:"id"`
			Name  string          `json:"name"`
			Input json.RawMessage `json:"input"`
		} `json:"content"`
	}
	json.Unmarshal(r.ResponseBody, &body)
	if len(body.Content) != 1 {
		t.Fatalf("content blocks = %d, want 1", len(body.Content))
	}
	if body.Content[0].Type != "tool_use" {
		t.Errorf("type = %q, want tool_use", body.Content[0].Type)
	}
	if body.Content[0].ID != "toolu_01" {
		t.Errorf("id = %q", body.Content[0].ID)
	}
	if body.Content[0].Name != "read_file" {
		t.Errorf("name = %q", body.Content[0].Name)
	}
	if string(body.Content[0].Input) != `{"path":"/tmp/test"}` {
		t.Errorf("input = %q", string(body.Content[0].Input))
	}
}

func TestAnthropicMessages_ParseStream_MixedContent(t *testing.T) {
	// Response with text + thinking + tool_use.
	events := []SSEEvent{
		{Event: "message_start", Data: []byte(`{"message":{"model":"claude-sonnet-4-6","usage":{"input_tokens":200}}}`)},
		{Event: "content_block_start", Data: []byte(`{"content_block":{"type":"thinking"}}`)},
		{Event: "content_block_delta", Data: []byte(`{"delta":{"type":"thinking_delta","thinking":"Let me think..."}}`)},
		{Event: "content_block_stop", Data: []byte(`{}`)},
		{Event: "content_block_start", Data: []byte(`{"content_block":{"type":"text"}}`)},
		{Event: "content_block_delta", Data: []byte(`{"delta":{"type":"text_delta","text":"I'll read that file."}}`)},
		{Event: "content_block_stop", Data: []byte(`{}`)},
		{Event: "content_block_start", Data: []byte(`{"content_block":{"type":"tool_use","id":"toolu_02","name":"read_file"}}`)},
		{Event: "content_block_delta", Data: []byte(`{"delta":{"type":"input_json_delta","partial_json":"{\"pa"}}`)},
		{Event: "content_block_delta", Data: []byte(`{"delta":{"type":"input_json_delta","partial_json":"th\":\"/etc/hosts\"}"}}`)},
		{Event: "content_block_stop", Data: []byte(`{}`)},
		{Event: "message_delta", Data: []byte(`{"usage":{"output_tokens":80}}`)},
	}

	r, err := AnthropicMessages.ParseStream(events)
	if err != nil {
		t.Fatal(err)
	}

	var body struct {
		Content []struct {
			Type  string          `json:"type"`
			Text  string          `json:"text"`
			ID    string          `json:"id"`
			Name  string          `json:"name"`
			Input json.RawMessage `json:"input"`
		} `json:"content"`
	}
	json.Unmarshal(r.ResponseBody, &body)

	if len(body.Content) != 3 {
		t.Fatalf("content blocks = %d, want 3", len(body.Content))
	}
	// Thinking block
	if body.Content[0].Type != "thinking" || body.Content[0].Text != "Let me think..." {
		t.Errorf("thinking block = %+v", body.Content[0])
	}
	// Text block
	if body.Content[1].Type != "text" || body.Content[1].Text != "I'll read that file." {
		t.Errorf("text block = %+v", body.Content[1])
	}
	// Tool use block with concatenated JSON
	if body.Content[2].Type != "tool_use" || body.Content[2].Name != "read_file" {
		t.Errorf("tool block = %+v", body.Content[2])
	}
	if string(body.Content[2].Input) != `{"path":"/etc/hosts"}` {
		t.Errorf("input = %q", string(body.Content[2].Input))
	}
}
