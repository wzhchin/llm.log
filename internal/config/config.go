package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/lanesket/llm.log/internal/provider/wire"
	"gopkg.in/yaml.v3"
)

// CustomProvider defines a user-configured LLM API endpoint.
type CustomProvider struct {
	Name    string   `yaml:"name"`
	Domain  string   `yaml:"domain"`
	Formats []string `yaml:"formats"`
}

func (c *CustomProvider) validate() error {
	if len(c.Formats) == 0 {
		return fmt.Errorf("formats is required")
	}
	return nil
}

// Config holds all user configuration loaded from config.yaml.
type Config struct {
	Custom []CustomProvider `yaml:"custom"`
}

// Load reads config.yaml from the data directory.
// Returns an empty Config if the file does not exist.
func Load(dataDir string) (*Config, error) {
	path := filepath.Join(dataDir, "config.yaml")

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &Config{}, nil
		}
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
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
		if err := c.validate(); err != nil {
			return nil, fmt.Errorf("custom[%d]: %w", i, err)
		}
		if _, err := ParseFormats(c.Formats); err != nil {
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

// ParseFormats maps a list of format strings to wire.Format values.
func ParseFormats(ss []string) ([]wire.Format, error) {
	out := make([]wire.Format, 0, len(ss))
	for _, s := range ss {
		f, err := ParseFormat(s)
		if err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, nil
}
