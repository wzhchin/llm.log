package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/lanesket/llm.log/internal/provider/wire"
	toml "github.com/pelletier/go-toml/v2"
)

// CustomProvider defines a user-configured LLM API endpoint.
type CustomProvider struct {
	Name   string `toml:"name"`
	Domain string `toml:"domain"`
	Format string `toml:"format"` // "chat_completions", "responses", "anthropic_messages"
}

// Config holds all user configuration loaded from config.toml.
type Config struct {
	Custom []CustomProvider `toml:"custom"`
}

// Load reads config.toml from the data directory.
// Returns an empty Config if the file does not exist.
func Load(dataDir string) (*Config, error) {
	path := filepath.Join(dataDir, "config.toml")

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &Config{}, nil
		}
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := toml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	// Validate entries
	for i, c := range cfg.Custom {
		if c.Name == "" {
			return nil, fmt.Errorf("custom[%d]: name is required", i)
		}
		if c.Domain == "" {
			return nil, fmt.Errorf("custom[%d]: domain is required", i)
		}
		if _, err := ParseFormat(c.Format); err != nil {
			return nil, fmt.Errorf("custom[%d]: %w", i, err)
		}
	}

	return &cfg, nil
}

// ParseFormat maps a format string to a wire.Format.
func ParseFormat(s string) (wire.Format, error) {
	switch s {
	case "chat_completions":
		return wire.ChatCompletions, nil
	case "responses":
		return wire.Responses, nil
	case "anthropic_messages":
		return wire.AnthropicMessages, nil
	default:
		return nil, fmt.Errorf("unknown format %q (valid: chat_completions, responses, anthropic_messages)", s)
	}
}
