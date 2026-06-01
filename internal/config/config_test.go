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

func TestLoad_ValidConfig(t *testing.T) {
	dir := t.TempDir()
	content := `
[[custom]]
name = "my-api"
domain = "my-proxy.example.com"
format = "chat_completions"

[[custom]]
name = "local-claude"
domain = "192.168.1.100"
format = "anthropic_messages"
`
	if err := os.WriteFile(filepath.Join(dir, "config.toml"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	cfg, err := Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(cfg.Custom) != 2 {
		t.Fatalf("expected 2 custom providers, got %d", len(cfg.Custom))
	}
	if cfg.Custom[0].Name != "my-api" {
		t.Errorf("custom[0].Name = %q, want %q", cfg.Custom[0].Name, "my-api")
	}
	if cfg.Custom[0].Domain != "my-proxy.example.com" {
		t.Errorf("custom[0].Domain = %q, want %q", cfg.Custom[0].Domain, "my-proxy.example.com")
	}
	if cfg.Custom[1].Name != "local-claude" {
		t.Errorf("custom[1].Name = %q, want %q", cfg.Custom[1].Name, "local-claude")
	}
}

func TestLoad_InvalidFormat(t *testing.T) {
	dir := t.TempDir()
	content := `
[[custom]]
name = "bad"
domain = "example.com"
format = "unknown_format"
`
	if err := os.WriteFile(filepath.Join(dir, "config.toml"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	_, err := Load(dir)
	if err == nil {
		t.Fatal("expected error for unknown format")
	}
}

func TestLoad_MissingName(t *testing.T) {
	dir := t.TempDir()
	content := `
[[custom]]
domain = "example.com"
format = "chat_completions"
`
	if err := os.WriteFile(filepath.Join(dir, "config.toml"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	_, err := Load(dir)
	if err == nil {
		t.Fatal("expected error for missing name")
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
