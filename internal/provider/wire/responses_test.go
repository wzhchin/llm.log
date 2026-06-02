package wire

import (
	"encoding/json"
	"testing"
)

func TestResponses_Parse(t *testing.T) {
	body := []byte(`{
		"model": "gpt-4.1",
		"usage": {
			"input_tokens": 100,
			"output_tokens": 50,
			"input_token_details": {"cached_tokens": 20}
		}
	}`)

	r, err := Responses.Parse(body)
	if err != nil {
		t.Fatal(err)
	}
	if r.Model != "gpt-4.1" {
		t.Errorf("model = %q", r.Model)
	}
	if r.InputTokens != 100 {
		t.Errorf("input = %d, want 100", r.InputTokens)
	}
	if r.OutputTokens != 50 {
		t.Errorf("output = %d, want 50", r.OutputTokens)
	}
	if r.CacheReadTokens != 20 {
		t.Errorf("cached = %d, want 20", r.CacheReadTokens)
	}
}

func TestResponses_ParseStream(t *testing.T) {
	events := []SSEEvent{
		{Event: "response.created", Data: []byte(`{"type":"response.created","response":{"id":"resp_1","status":"in_progress"}}`)},
		{Event: "response.output_text.delta", Data: []byte(`{"type":"response.output_text.delta","delta":"Hello"}`)},
		{Event: "response.output_text.delta", Data: []byte(`{"type":"response.output_text.delta","delta":" world"}`)},
		{Event: "response.completed", Data: []byte(`{"type":"response.completed","response":{"model":"gpt-4.1","usage":{"input_tokens":100,"output_tokens":2,"input_token_details":{"cached_tokens":30}}}}`)},
	}

	r, err := Responses.ParseStream(events)
	if err != nil {
		t.Fatal(err)
	}
	if r.Model != "gpt-4.1" {
		t.Errorf("model = %q", r.Model)
	}
	if r.InputTokens != 100 {
		t.Errorf("input = %d, want 100", r.InputTokens)
	}
	if r.OutputTokens != 2 {
		t.Errorf("output = %d, want 2", r.OutputTokens)
	}
	if r.CacheReadTokens != 30 {
		t.Errorf("cached = %d, want 30", r.CacheReadTokens)
	}

	var body map[string]any
	json.Unmarshal(r.ResponseBody, &body)
	if body["content"] != "Hello world" {
		t.Errorf("content = %q", body["content"])
	}
}

func TestResponses_Parse_AudioTokens(t *testing.T) {
	body := []byte(`{
		"model": "gpt-4o-audio-preview",
		"usage": {
			"input_tokens": 1000,
			"output_tokens": 500,
			"input_token_details": {"cached_tokens": 0, "audio_tokens": 600},
			"output_token_details": {"audio_tokens": 250}
		}
	}`)

	r, err := Responses.Parse(body)
	if err != nil {
		t.Fatal(err)
	}
	d, ok := r.Details.(OpenAIDetails)
	if !ok {
		t.Fatal("expected OpenAIDetails")
	}
	if d.AudioInputTokens != 600 {
		t.Errorf("audio input = %d, want 600", d.AudioInputTokens)
	}
	if d.AudioOutputTokens != 250 {
		t.Errorf("audio output = %d, want 250", d.AudioOutputTokens)
	}
}

func TestResponses_ParseStream_AudioTokens(t *testing.T) {
	events := []SSEEvent{
		{Event: "response.output_text.delta", Data: []byte(`{"type":"response.output_text.delta","delta":"Hi"}`)},
		{Event: "response.completed", Data: []byte(`{"type":"response.completed","response":{"model":"gpt-4o-audio","usage":{"input_tokens":500,"output_tokens":200,"input_token_details":{"cached_tokens":0,"audio_tokens":300},"output_token_details":{"audio_tokens":100}}}}`)},
	}

	r, err := Responses.ParseStream(events)
	if err != nil {
		t.Fatal(err)
	}
	d, ok := r.Details.(OpenAIDetails)
	if !ok {
		t.Fatal("expected OpenAIDetails")
	}
	if d.AudioInputTokens != 300 {
		t.Errorf("audio input = %d, want 300", d.AudioInputTokens)
	}
	if d.AudioOutputTokens != 100 {
		t.Errorf("audio output = %d, want 100", d.AudioOutputTokens)
	}
}

func TestResponses_ModifyRequest_Passthrough(t *testing.T) {
	body := []byte(`{"model":"gpt-4.1","input":[]}`)
	result, err := Responses.ModifyRequest(body)
	if err != nil {
		t.Fatal(err)
	}
	if string(result) != string(body) {
		t.Error("Responses API should not modify requests")
	}
}

func TestResponses_ParseStream_FunctionCallOnly(t *testing.T) {
	// Response with only function calls, no text — the original bug scenario.
	events := []SSEEvent{
		{Event: "response.output_item.added", Data: []byte(`{"item":{"type":"function_call","call_id":"call_1","name":"get_weather"}}`)},
		{Event: "response.function_call_arguments.delta", Data: []byte(`{"delta":"{\"ci"}`)},
		{Event: "response.function_call_arguments.delta", Data: []byte(`{"delta":"ty\":\"Paris\"}"}`)},
		{Event: "response.completed", Data: []byte(`{"response":{"model":"gpt-4.1","usage":{"input_tokens":50,"output_tokens":20,"input_token_details":{"cached_tokens":0}}}}`)},
	}

	r, err := Responses.ParseStream(events)
	if err != nil {
		t.Fatal(err)
	}
	if r.Model != "gpt-4.1" {
		t.Errorf("model = %q", r.Model)
	}
	if r.OutputTokens != 20 {
		t.Errorf("output = %d, want 20", r.OutputTokens)
	}

	var body struct {
		Output []struct {
			Type      string `json:"type"`
			CallID    string `json:"call_id"`
			Name      string `json:"name"`
			Arguments string `json:"arguments"`
		} `json:"output"`
	}
	json.Unmarshal(r.ResponseBody, &body)

	if len(body.Output) != 1 {
		t.Fatalf("output items = %d, want 1", len(body.Output))
	}
	item := body.Output[0]
	if item.Type != "function_call" {
		t.Errorf("type = %q", item.Type)
	}
	if item.CallID != "call_1" {
		t.Errorf("call_id = %q", item.CallID)
	}
	if item.Name != "get_weather" {
		t.Errorf("name = %q", item.Name)
	}
	if item.Arguments != `{"city":"Paris"}` {
		t.Errorf("arguments = %q", item.Arguments)
	}
}

func TestResponses_ParseStream_TextAndFunctionCall(t *testing.T) {
	events := []SSEEvent{
		{Event: "response.output_text.delta", Data: []byte(`{"delta":"Checking weather."}`)},
		{Event: "response.output_item.added", Data: []byte(`{"item":{"type":"function_call","call_id":"call_2","name":"search"}}`)},
		{Event: "response.function_call_arguments.delta", Data: []byte(`{"delta":"{\"q\":\"test\"}"}`)},
		{Event: "response.completed", Data: []byte(`{"response":{"model":"gpt-4.1","usage":{"input_tokens":100,"output_tokens":30,"input_token_details":{"cached_tokens":10}}}}`)},
	}

	r, err := Responses.ParseStream(events)
	if err != nil {
		t.Fatal(err)
	}
	if r.CacheReadTokens != 10 {
		t.Errorf("cached = %d, want 10", r.CacheReadTokens)
	}

	var body struct {
		Output []struct {
			Type    string `json:"type"`
			Role    string `json:"role"`
			Content any    `json:"content"`
			Name    string `json:"name"`
		} `json:"output"`
	}
	json.Unmarshal(r.ResponseBody, &body)

	// Should have: message (text) + function_call
	if len(body.Output) != 2 {
		t.Fatalf("output items = %d, want 2", len(body.Output))
	}
	if body.Output[0].Type != "message" {
		t.Errorf("first item type = %q, want message", body.Output[0].Type)
	}
	if body.Output[1].Type != "function_call" {
		t.Errorf("second item type = %q, want function_call", body.Output[1].Type)
	}
	if body.Output[1].Name != "search" {
		t.Errorf("name = %q", body.Output[1].Name)
	}
}
