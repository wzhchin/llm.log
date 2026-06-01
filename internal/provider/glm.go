package provider

import "github.com/lanesket/llm.log/internal/provider/wire"

// API docs: https://open.bigmodel.cn/dev/api/normal-model/glm-4

func init() { Register(&glmProvider{}) }

type glmProvider struct{}

func (g *glmProvider) Name() string           { return "glm" }
func (g *glmProvider) Domains() []string      { return []string{"open.bigmodel.cn"} }
func (g *glmProvider) Formats() []wire.Format { return []wire.Format{wire.ChatCompletions} }
