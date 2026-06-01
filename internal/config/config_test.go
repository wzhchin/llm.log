package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/lanesket/llm.log/internal/provider/wire"
)

func TestLoad_MissingFile(t *testing.T) {
	dir := t.TempDir()
	cfg, err := Load(dir)
	if err != nil {
		t.Fatalf("Load with missing file: %v", err)
	}
	if len(cfg.Custom) != 0 {
		t.Errorf("expected 0 custom providers, got %d", len(cfg.Custom))
	}
}

func TestLoad_SingleFormat(t *testing.T) {
	dir := t.TempDir()
	content := `custom:
  - name: my-api
    domain: my-proxy.example.com
    formats:
      - chat_completions
`
	if err := os.WriteFile(filepath.Join(dir, "config.yaml"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	cfg, err := Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(cfg.Custom) != 1 {
		t.Fatalf("expected 1 custom provider, got %d", len(cfg.Custom))
	}
	if cfg.Custom[0].Name != "my-api" {
		t.Errorf("custom[0].Name = %q, want %q", cfg.Custom[0].Name, "my-api")
	}
	if cfg.Custom[0].Domain != "my-proxy.example.com" {
		t.Errorf("custom[0].Domain = %q, want %q", cfg.Custom[0].Domain, "my-proxy.example.com")
	}
	if len(cfg.Custom[0].Formats) != 1 || cfg.Custom[0].Formats[0] != "chat_completions" {
		t.Errorf("custom[0].Formats = %v, want [chat_completions]", cfg.Custom[0].Formats)
	}
}

func TestLoad_MultipleFormats(t *testing.T) {
	dir := t.TempDir()
	content := `custom:
  - name: glm
    domain: open.bigmodel.cn
    formats:
      - chat_completions
      - anthropic_messages
`
	if err := os.WriteFile(filepath.Join(dir, "config.yaml"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	cfg, err := Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(cfg.Custom) != 1 {
		t.Fatalf("expected 1 custom provider, got %d", len(cfg.Custom))
	}
	if len(cfg.Custom[0].Formats) != 2 {
		t.Fatalf("expected 2 formats, got %d", len(cfg.Custom[0].Formats))
	}
	if cfg.Custom[0].Formats[0] != "chat_completions" {
		t.Errorf("formats[0] = %q, want %q", cfg.Custom[0].Formats[0], "chat_completions")
	}
	if cfg.Custom[0].Formats[1] != "anthropic_messages" {
		t.Errorf("formats[1] = %q, want %q", cfg.Custom[0].Formats[1], "anthropic_messages")
	}
}

func TestLoad_InvalidFormat(t *testing.T) {
	dir := t.TempDir()
	content := `custom:
  - name: bad
    domain: example.com
    formats:
      - unknown_format
`
	if err := os.WriteFile(filepath.Join(dir, "config.yaml"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	_, err := Load(dir)
	if err == nil {
		t.Fatal("expected error for unknown format")
	}
}

func TestLoad_MissingName(t *testing.T) {
	dir := t.TempDir()
	content := `custom:
  - domain: example.com
    formats:
      - chat_completions
`
	if err := os.WriteFile(filepath.Join(dir, "config.yaml"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	_, err := Load(dir)
	if err == nil {
		t.Fatal("expected error for missing name")
	}
}

func TestLoad_MissingFormats(t *testing.T) {
	dir := t.TempDir()
	content := `custom:
  - name: test
    domain: example.com
`
	if err := os.WriteFile(filepath.Join(dir, "config.yaml"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	_, err := Load(dir)
	if err == nil {
		t.Fatal("expected error for missing formats")
	}
}

func TestParseFormat(t *testing.T) {
	tests := []struct {
		input string
		want  wire.Format
	}{
		{"chat_completions", wire.ChatCompletions},
		{"responses", wire.Responses},
		{"anthropic_messages", wire.AnthropicMessages},
	}
	for _, tt := range tests {
		got, err := ParseFormat(tt.input)
		if err != nil {
			t.Errorf("ParseFormat(%q): %v", tt.input, err)
			continue
		}
		if got != tt.want {
			t.Errorf("ParseFormat(%q) = %T, want %T", tt.input, got, tt.want)
		}
	}
}

func TestParseFormat_Unknown(t *testing.T) {
	_, err := ParseFormat("bogus")
	if err == nil {
		t.Fatal("expected error for unknown format")
	}
}

func TestParseFormats(t *testing.T) {
	fmts, err := ParseFormats([]string{"chat_completions", "responses"})
	if err != nil {
		t.Fatal(err)
	}
	if len(fmts) != 2 {
		t.Fatalf("expected 2 formats, got %d", len(fmts))
	}
	if fmts[0] != wire.ChatCompletions {
		t.Errorf("formats[0] = %T, want ChatCompletions", fmts[0])
	}
	if fmts[1] != wire.Responses {
		t.Errorf("formats[1] = %T, want Responses", fmts[1])
	}
}
