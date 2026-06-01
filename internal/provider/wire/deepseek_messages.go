package wire

// DeepseekMessages will parse the DeepSeek Messages API format.
// TODO: implement when DeepSeek provides a Messages-style endpoint.
var DeepseekMessages Format = (*deepseekMessagesFormat)(nil)

type deepseekMessagesFormat struct{}

func (d *deepseekMessagesFormat) MatchPath(string) bool        { return false }
func (d *deepseekMessagesFormat) ModifyRequest(b []byte) ([]byte, error) { return b, nil }
func (d *deepseekMessagesFormat) Parse([]byte) (*Result, error)         { return &Result{}, nil }
func (d *deepseekMessagesFormat) ParseStream([]SSEEvent) (*Result, error) { return &Result{}, nil }
