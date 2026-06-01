package provider

import (
	"fmt"

	"github.com/lanesket/llm.log/internal/config"
	"github.com/lanesket/llm.log/internal/provider/wire"
)

// Provider maps a domain to its supported API formats.
// Formats are listed most-specific first; the last one is the default fallback.
type Provider interface {
	Name() string
	Domains() []string
	 Formats() []wire.Format
}

// ResolveFormat finds the matching format for a request path.
// Falls back to the provider's last (default) format.
func ResolveFormat(p Provider, path string) wire.Format {
	fmts := p.Formats()
	for _, f := range fmts {
		if f.MatchPath(path) {
			return f
		}
	}
	return fmts[len(fmts)-1]
}

var providers = map[string]Provider{}

func Register(p Provider) {
	for _, d := range p.Domains() {
		providers[d] = p
	}
}

func Lookup(domain string) (Provider, bool) {
	p, ok := providers[domain]
	return p, ok
}

// RegisterCustom registers custom providers from config.
// Returns the first error encountered; already-registered entries remain.
func RegisterCustom(cfg *config.Config) error {
	var firstErr error
	for _, c := range cfg.Custom {
		fmts, err := config.ParseFormats(c.Formats)
		if err != nil {
			if firstErr == nil {
				firstErr = fmt.Errorf("custom provider %q: %w", c.Name, err)
			}
			continue
		}
		// When usage_fields is set, replace chat_completions with a
		// dynamically-mapped variant.
		if len(c.UsageFields) > 0 {
			for i, f := range fmts {
				if f == wire.ChatCompletions {
					fmts[i] = wire.NewCCFormatFromFields("/chat/completions", c.UsageFields)
				}
			}
		}
		Register(&customProvider{
			name:    c.Name,
			domain:  c.Domain,
			formats: fmts,
		})
	}
	return firstErr
}

// customProvider implements Provider for user-configured endpoints.
type customProvider struct {
	name    string
	domain  string
	formats []wire.Format
}

func (cp *customProvider) Name() string           { return cp.name }
func (cp *customProvider) Domains() []string      { return []string{cp.domain} }
func (cp *customProvider) Formats() []wire.Format { return cp.formats }
