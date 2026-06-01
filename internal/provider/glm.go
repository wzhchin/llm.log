package provider

import "github.com/lanesket/llm.log/internal/provider/wire"

// API docs: https://open.bigmodel.cn/dev/api

func init() { Register(&glmProvider{}) }

type glmProvider struct{}

func (g *glmProvider) Name() string      { return "glm" }
func (g *glmProvider) Domains() []string { return []string{"open.bigmodel.cn", "api.z.ai"} }
func (g *glmProvider) Formats() []wire.Format {
	return []wire.Format{wire.GLMMessages, wire.GLMChatCompletions}
}
