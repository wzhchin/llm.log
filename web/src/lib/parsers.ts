import {
  type TreeNode, type ParsedResult,
  nodeId, resetIdCounter, ROLE_STYLES,
} from './types-structured';

// Re-export for convenience
export type { ParsedResult } from './types-structured';

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function parseBodies(
  requestBody: string,
  responseBody: string,
  endpoint: string,
): ParsedResult {
  resetIdCounter();

  let reqJson: unknown;
  let resJson: unknown;

  try {
    reqJson = requestBody ? JSON.parse(requestBody) : null;
  } catch {
    reqJson = null;
  }
  try {
    resJson = responseBody ? JSON.parse(responseBody) : null;
  } catch {
    resJson = null;
  }

  if (reqJson === null && resJson === null) {
    return { request: emptyRoot('Request'), response: emptyRoot('Response'), error: 'Failed to parse JSON bodies' };
  }

  const ep = endpoint ?? '';

  if (ep.includes('/messages')) {
    return parseAnthropic(reqJson, resJson);
  }
  if (ep.includes('/chat/completions') || ep.includes('/sonar')) {
    return parseChatCompletions(reqJson, resJson);
  }
  if (ep.includes('/responses')) {
    return parseResponsesAPI(reqJson, resJson);
  }

  return parseGeneric(reqJson, resJson);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyRoot(label: string): TreeNode {
  const s = ROLE_STYLES.root;
  return { id: nodeId('r'), type: 'root', label, rawLabel: label.toLowerCase(), borderClass: s.border, bgClass: s.bg, children: [] };
}

function makeNode(p: {
  type: TreeNode['type'];
  role?: TreeNode['role'];
  label: string;
  rawLabel: string;
  text?: string;
  imageUrl?: string;
  isBase64Image?: boolean;
  fileName?: string;
  fileType?: string;
  metadata?: Record<string, string | number | boolean>;
  children?: TreeNode[];
}): TreeNode {
  const styleKey = p.type === 'thinking' ? 'thinking'
    : p.type === 'error' ? 'error'
    : p.type === 'tool-call' || p.type === 'tool-result' ? 'tool'
    : p.role ?? 'generic';
  const s = ROLE_STYLES[styleKey] ?? ROLE_STYLES.generic;
  return {
    id: nodeId(p.type.slice(0, 2)),
    type: p.type,
    role: p.role,
    label: p.label,
    rawLabel: p.rawLabel,
    borderClass: s.border,
    bgClass: s.bg,
    text: p.text,
    imageUrl: p.imageUrl,
    isBase64Image: p.isBase64Image,
    fileName: p.fileName,
    fileType: p.fileType,
    metadata: p.metadata,
    children: p.children ?? [],
  };
}


function extractMetadata(obj: Record<string, unknown>, skip: Set<string>): Record<string, string | number | boolean> | undefined {
  const md: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (skip.has(k)) continue;
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      md[k] = v;
    }
  }
  return Object.keys(md).length > 0 ? md : undefined;
}

function jsonStringify(v: unknown): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

// ---------------------------------------------------------------------------
// Anthropic Messages  (/v1/messages)
// ---------------------------------------------------------------------------

function parseAnthropic(req: unknown, res: unknown): ParsedResult {
  const reqObj = req as Record<string, any> | null;
  const resObj = res as Record<string, any> | null;

  const skipReq = new Set(['system', 'messages', 'tools', 'tool_choice']);
  const request = makeNode({
    type: 'root', label: 'Request', rawLabel: 'request',
    metadata: reqObj ? extractMetadata(reqObj, skipReq) : undefined,
    children: [
      ...parseAnthropicSystem(reqObj),
      ...parseAnthropicMessages(reqObj?.messages),
    ],
  });

  const response = makeNode({
    type: 'root', label: 'Response', rawLabel: 'response',
    metadata: resObj ? { model: resObj.model ?? '', stop_reason: resObj.stop_reason ?? '' } : undefined,
    children: [
      ...parseAnthropicResponseContent(resObj),
      ...parseAnthropicError(resObj),
    ],
  });

  return { request, response };
}

function parseAnthropicSystem(req: Record<string, any> | null): TreeNode[] {
  if (!req?.system) return [];
  const sys = req.system;
  if (typeof sys === 'string') {
    return [makeNode({ type: 'system', role: 'system', label: '📄 System Prompt', rawLabel: 'system', text: sys })];
  }
  if (Array.isArray(sys)) {
    const text = sys.map((b: any) => b.text ?? '').filter(Boolean).join('\n');
    return [makeNode({ type: 'system', role: 'system', label: `📄 System Prompt (${sys.length} blocks)`, rawLabel: 'system', text })];
  }
  return [];
}

function parseAnthropicMessages(messages: any[] | undefined): TreeNode[] {
  if (!Array.isArray(messages)) return [];
  return messages.map((msg, i) => {
    const role = msg.role ?? 'user';
    const icon = role === 'user' ? '💬' : role === 'assistant' ? '🤖' : '📄';
    const content = msg.content;

    if (typeof content === 'string') {
      return makeNode({
        type: 'message', role: role as any,
        label: `${icon} ${capitalize(role)}`,
        rawLabel: `messages[${i}]`,
        text: content,
      });
    }

    if (Array.isArray(content)) {
      const children: TreeNode[] = [];
      let textParts: string[] = [];

      for (let j = 0; j < content.length; j++) {
        const block = content[j];
        if (!block?.type) continue;

        if (block.type === 'text') {
          textParts.push(block.text ?? '');
        } else if (block.type === 'image') {
          const src = block.source;
          if (src?.type === 'base64') {
            children.push(makeNode({
              type: 'content-block', label: '🖼️ Image (base64)', rawLabel: `messages[${i}].content[${j}]`,
              isBase64Image: true,
            }));
          } else if (src?.url) {
            children.push(makeNode({
              type: 'content-block', label: '🖼️ Image', rawLabel: `messages[${i}].content[${j}]`,
              imageUrl: src.url,
            }));
          }
        } else if (block.type === 'tool_use') {
          children.push(makeNode({
            type: 'tool-call', role: 'tool',
            label: `🔧 ${block.name ?? 'tool'}`,
            rawLabel: `messages[${i}].content[${j}]`,
            metadata: { id: block.id ?? '', name: block.name ?? '' },
            text: jsonStringify(block.input),
          }));
        } else if (block.type === 'tool_result') {
          const resultText = typeof block.content === 'string'
            ? block.content
            : Array.isArray(block.content)
              ? block.content.map((c: any) => c.text ?? '').join('')
              : jsonStringify(block.content);
          children.push(makeNode({
            type: 'tool-result', role: 'tool',
            label: `🔧 Tool Result${block.tool_use_id ? ` (${block.tool_use_id.slice(0, 8)})` : ''}`,
            rawLabel: `messages[${i}].content[${j}]`,
            text: resultText,
          }));
        }
      }

      const mainText = textParts.join('\n');
      const blockCount = content.length;
      const summary = blockCount > 1 ? ` (${blockCount} blocks)` : '';

      return makeNode({
        type: 'message', role: role as any,
        label: `${icon} ${capitalize(role)}${summary}`,
        rawLabel: `messages[${i}]`,
        text: mainText || undefined,
        children,
      });
    }

    return makeNode({
      type: 'message', role: role as any,
      label: `${icon} ${capitalize(role)}`,
      rawLabel: `messages[${i}]`,
      text: jsonStringify(content),
    });
  });
}

function parseAnthropicResponseContent(res: Record<string, any> | null): TreeNode[] {
  if (!res) return [];

  // Streaming reconstructed body: { model, content: "string" }
  if (typeof res.content === 'string') {
    return [makeNode({
      type: 'message', role: 'assistant',
      label: '🤖 Assistant', rawLabel: 'content',
      text: res.content,
    })];
  }

  if (!Array.isArray(res.content)) return [];

  const children: TreeNode[] = [];
  let textParts: string[] = [];

  for (let i = 0; i < res.content.length; i++) {
    const block = res.content[i];
    if (!block?.type) continue;

    if (block.type === 'text') {
      textParts.push(block.text ?? '');
    } else if (block.type === 'thinking') {
      children.push(makeNode({
        type: 'thinking',
        label: '💭 Thinking',
        rawLabel: `content[${i}]`,
        text: block.thinking ?? '',
      }));
    } else if (block.type === 'tool_use') {
      children.push(makeNode({
        type: 'tool-call', role: 'tool',
        label: `🔧 ${block.name ?? 'tool'}`,
        rawLabel: `content[${i}]`,
        metadata: { id: block.id ?? '', name: block.name ?? '' },
        text: jsonStringify(block.input),
      }));
    }
  }

  const mainText = textParts.join('\n');
  const blockCount = res.content.length;
  const summary = blockCount > 1 ? ` (${blockCount} blocks)` : '';

  return [makeNode({
    type: 'message', role: 'assistant',
    label: `🤖 Assistant${summary}`,
    rawLabel: 'content',
    text: mainText || undefined,
    children,
  })];
}

function parseAnthropicError(res: Record<string, any> | null): TreeNode[] {
  if (!res?.error) return [];
  const err = typeof res.error === 'string' ? res.error : res.error.message ?? jsonStringify(res.error);
  return [makeNode({ type: 'error', label: '❌ Error', rawLabel: 'error', text: err })];
}

// ---------------------------------------------------------------------------
// Chat Completions  (/v1/chat/completions)
// ---------------------------------------------------------------------------

function parseChatCompletions(req: unknown, res: unknown): ParsedResult {
  const reqObj = req as Record<string, any> | null;
  const resObj = res as Record<string, any> | null;

  const skipReq = new Set(['messages', 'tools', 'tool_choice']);
  const request = makeNode({
    type: 'root', label: 'Request', rawLabel: 'request',
    metadata: reqObj ? extractMetadata(reqObj, skipReq) : undefined,
    children: parseCCMessages(reqObj?.messages),
  });

  const resChildren: TreeNode[] = [];

  // Streaming reconstructed body: { model, content: "string" }
  if (resObj && typeof resObj.content === 'string' && !resObj.choices) {
    resChildren.push(makeNode({
      type: 'message', role: 'assistant',
      label: '🤖 Assistant', rawLabel: 'content',
      text: resObj.content,
    }));
  } else if (resObj?.choices) {
    for (let i = 0; i < resObj.choices.length; i++) {
      const choice = resObj.choices[i];
      const msg = choice.message ?? choice;
      resChildren.push(...parseCCAssistantMessage(msg, i));
    }
  }

  if (resObj?.error) {
    const err = typeof resObj.error === 'string' ? resObj.error : resObj.error.message ?? jsonStringify(resObj.error);
    resChildren.push(makeNode({ type: 'error', label: '❌ Error', rawLabel: 'error', text: err }));
  }

  const response = makeNode({
    type: 'root', label: 'Response', rawLabel: 'response',
    metadata: resObj ? extractMetadata(resObj, new Set(['choices', 'error', 'usage'])) : undefined,
    children: resChildren,
  });

  return { request, response };
}

function parseCCMessages(messages: any[] | undefined): TreeNode[] {
  if (!Array.isArray(messages)) return [];
  return messages.map((msg, i) => {
    const role = msg.role ?? 'user';

    // System message
    if (role === 'system') {
      return makeNode({
        type: 'system', role: 'system',
        label: '📄 System Prompt', rawLabel: `messages[${i}]`,
        text: typeof msg.content === 'string' ? msg.content : jsonStringify(msg.content),
      });
    }

    // Tool result
    if (role === 'tool') {
      return makeNode({
        type: 'tool-result', role: 'tool',
        label: `🔧 Tool Result${msg.tool_call_id ? ` (${msg.tool_call_id.slice(0, 8)})` : ''}`,
        rawLabel: `messages[${i}]`,
        text: typeof msg.content === 'string' ? msg.content : jsonStringify(msg.content),
      });
    }

    // User / Assistant
    const icon = role === 'user' ? '💬' : '🤖';
    const children: TreeNode[] = [];

    // Tool calls in assistant message
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        const fn = tc.function ?? {};
        children.push(makeNode({
          type: 'tool-call', role: 'tool',
          label: `🔧 ${fn.name ?? 'tool'}`,
          rawLabel: `messages[${i}].tool_calls[${tc.index ?? 0}]`,
          metadata: { id: tc.id ?? '', name: fn.name ?? '' },
          text: fn.arguments ?? '',
        }));
      }
    }

    const contentText = typeof msg.content === 'string' ? msg.content : jsonStringify(msg.content);

    return makeNode({
      type: 'message', role: role as any,
      label: `${icon} ${capitalize(role)}`,
      rawLabel: `messages[${i}]`,
      text: contentText || undefined,
      children,
    });
  });
}

function parseCCAssistantMessage(msg: Record<string, any>, choiceIdx: number): TreeNode[] {
  const children: TreeNode[] = [];
  const role = msg.role ?? 'assistant';

  if (Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      const fn = tc.function ?? {};
      children.push(makeNode({
        type: 'tool-call', role: 'tool',
        label: `🔧 ${fn.name ?? 'tool'}`,
        rawLabel: `choices[${choiceIdx}].message.tool_calls[${tc.index ?? 0}]`,
        metadata: { id: tc.id ?? '', name: fn.name ?? '' },
        text: fn.arguments ?? '',
      }));
    }
  }

  const contentText = typeof msg.content === 'string' ? msg.content : jsonStringify(msg.content);

  return [makeNode({
    type: 'message', role: role as any,
    label: `🤖 ${capitalize(role)}${msg.tool_calls?.length ? ` (+${msg.tool_calls.length} tool calls)` : ''}`,
    rawLabel: `choices[${choiceIdx}].message`,
    text: contentText || undefined,
    children,
  })];
}

// ---------------------------------------------------------------------------
// Responses API  (/v1/responses)
// ---------------------------------------------------------------------------

function parseResponsesAPI(req: unknown, res: unknown): ParsedResult {
  const reqObj = req as Record<string, any> | null;
  const resObj = res as Record<string, any> | null;

  const skipReq = new Set(['input', 'instructions', 'tools', 'tool_choice']);
  const request = makeNode({
    type: 'root', label: 'Request', rawLabel: 'request',
    metadata: reqObj ? extractMetadata(reqObj, skipReq) : undefined,
    children: [
      ...parseResponsesInstructions(reqObj),
      ...parseResponsesInput(reqObj),
    ],
  });

  const response = makeNode({
    type: 'root', label: 'Response', rawLabel: 'response',
    metadata: resObj ? extractMetadata(resObj, new Set(['output', 'error', 'usage'])) : undefined,
    children: [
      ...parseResponsesOutput(resObj),
      ...parseResponsesError(resObj),
    ],
  });

  return { request, response };
}

function parseResponsesInstructions(req: Record<string, any> | null): TreeNode[] {
  if (!req?.instructions) return [];
  return [makeNode({
    type: 'system', role: 'system',
    label: '📄 Instructions', rawLabel: 'instructions',
    text: typeof req.instructions === 'string' ? req.instructions : jsonStringify(req.instructions),
  })];
}

function parseResponsesInput(req: Record<string, any> | null): TreeNode[] {
  if (!req?.input) return [];
  const input = req.input;

  if (typeof input === 'string') {
    return [makeNode({
      type: 'message', role: 'user',
      label: '💬 User', rawLabel: 'input',
      text: input,
    })];
  }

  if (Array.isArray(input)) {
    return input.map((item: any, i: number) => {
      if (typeof item === 'string') {
        return makeNode({
          type: 'message', role: 'user',
          label: '💬 User', rawLabel: `input[${i}]`,
          text: item,
        });
      }
      if (item?.type === 'message' || item?.role) {
        const role = item.role ?? 'user';
        const icon = role === 'user' ? '💬' : role === 'assistant' ? '🤖' : '📄';
        const text = typeof item.content === 'string' ? item.content
          : Array.isArray(item.content) ? item.content.map((c: any) => c.text ?? '').join('')
          : jsonStringify(item.content);
        return makeNode({
          type: 'message', role: role as any,
          label: `${icon} ${capitalize(role)}`, rawLabel: `input[${i}]`,
          text,
        });
      }
      if (item?.type === 'function_call_output') {
        return makeNode({
          type: 'tool-result', role: 'tool',
          label: `🔧 Function Output${item.call_id ? ` (${item.call_id.slice(0, 8)})` : ''}`,
          rawLabel: `input[${i}]`,
          text: item.output ?? '',
        });
      }
      return makeNode({
        type: 'generic', label: `input[${i}]`, rawLabel: `input[${i}]`,
        text: jsonStringify(item),
      });
    });
  }

  return [];
}

function parseResponsesOutput(res: Record<string, any> | null): TreeNode[] {
  if (!res) return [];

  // Streaming reconstructed body: { model, content: "string" }
  if (typeof res.content === 'string' && !res.output) {
    return [makeNode({
      type: 'message', role: 'assistant',
      label: '🤖 Assistant', rawLabel: 'content',
      text: res.content,
    })];
  }

  if (!Array.isArray(res.output)) return [];

  return res.output.map((item: any, i: number) => {
    if (item?.type === 'message') {
      const role = item.role ?? 'assistant';
      const icon = role === 'user' ? '💬' : '🤖';
      const contentParts: string[] = [];
      const children: TreeNode[] = [];

      if (Array.isArray(item.content)) {
        for (let j = 0; j < item.content.length; j++) {
          const part = item.content[j];
          if (part?.type === 'output_text' || part?.type === 'text') {
            contentParts.push(part.text ?? '');
          } else if (part?.type === 'image') {
            children.push(makeNode({
              type: 'content-block', label: '🖼️ Image', rawLabel: `output[${i}].content[${j}]`,
              imageUrl: part.image_url?.url ?? part.url,
            }));
          } else if (part?.text) {
            contentParts.push(part.text);
          }
        }
      } else if (typeof item.content === 'string') {
        contentParts.push(item.content);
      }

      return makeNode({
        type: 'message', role: role as any,
        label: `${icon} ${capitalize(role)}`,
        rawLabel: `output[${i}]`,
        text: contentParts.join('\n') || undefined,
        children,
      });
    }

    if (item?.type === 'function_call') {
      return makeNode({
        type: 'tool-call', role: 'tool',
        label: `🔧 ${item.name ?? 'function'}`,
        rawLabel: `output[${i}]`,
        metadata: { call_id: item.call_id ?? '', name: item.name ?? '' },
        text: item.arguments ?? '',
      });
    }

    if (item?.type === 'function_call_output') {
      return makeNode({
        type: 'tool-result', role: 'tool',
        label: `🔧 Function Output${item.call_id ? ` (${item.call_id.slice(0, 8)})` : ''}`,
        rawLabel: `output[${i}]`,
        text: item.output ?? '',
      });
    }

    return makeNode({
      type: 'generic', label: `output[${i}] (${item?.type ?? 'unknown'})`, rawLabel: `output[${i}]`,
      text: jsonStringify(item),
    });
  });
}

function parseResponsesError(res: Record<string, any> | null): TreeNode[] {
  if (!res?.error) return [];
  const err = typeof res.error === 'string' ? res.error : res.error.message ?? jsonStringify(res.error);
  return [makeNode({ type: 'error', label: '❌ Error', rawLabel: 'error', text: err })];
}

// ---------------------------------------------------------------------------
// Generic fallback parser
// ---------------------------------------------------------------------------

function parseGeneric(req: unknown, res: unknown): ParsedResult {
  const request = makeNode({
    type: 'root', label: 'Request', rawLabel: 'request',
    text: req ? jsonStringify(req) : undefined,
  });

  const response = makeNode({
    type: 'root', label: 'Response', rawLabel: 'response',
    text: res ? jsonStringify(res) : undefined,
  });

  return { request, response };
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
