export type BoxType =
  | 'root'
  | 'system'
  | 'message'
  | 'content-block'
  | 'tool-call'
  | 'tool-result'
  | 'thinking'
  | 'error'
  | 'generic';

export type Role = 'user' | 'assistant' | 'system' | 'tool';

export interface TreeNode {
  id: string;
  type: BoxType;
  role?: Role;
  label: string;
  rawLabel: string;
  borderClass: string;
  bgClass: string;
  text?: string;
  imageUrl?: string;
  isBase64Image?: boolean;
  fileName?: string;
  fileType?: string;
  metadata?: Record<string, string | number | boolean>;
  children: TreeNode[];
}

export const ROLE_STYLES: Record<string, { border: string; bg: string }> = {
  user: { border: 'border-l-blue-500/40', bg: 'bg-blue-500/5' },
  assistant: { border: 'border-l-emerald-500/40', bg: 'bg-emerald-500/5' },
  system: { border: 'border-l-gray-500/40', bg: 'bg-gray-500/5' },
  tool: { border: 'border-l-amber-500/40', bg: 'bg-amber-500/5' },
  error: { border: 'border-l-red-500/50', bg: 'bg-red-500/10' },
  thinking: { border: 'border-l-violet-500/40', bg: 'bg-violet-500/5' },
  generic: { border: 'border-l-[var(--color-text-tertiary)]', bg: 'bg-[var(--color-surface-raised)]' },
  root: { border: 'border-l-[var(--color-text-tertiary)]', bg: '' },
};

export const TYPE_ICONS: Record<BoxType, string> = {
  root: '',
  system: '📄',
  message: '',
  'content-block': '',
  'tool-call': '🔧',
  'tool-result': '🔧',
  thinking: '💭',
  error: '❌',
  generic: '',
};

export function getRoleIcon(type: BoxType, role?: Role): string {
  if (type === 'message' || type === 'content-block') {
    if (role === 'user') return '💬';
    if (role === 'assistant') return '🤖';
    if (role === 'system') return '📄';
    if (role === 'tool') return '🔧';
  }
  return TYPE_ICONS[type];
}

let _idCounter = 0;
export function nodeId(prefix: string = 'n'): string {
  return `${prefix}-${++_idCounter}`;
}

export function resetIdCounter(): void {
  _idCounter = 0;
}

export interface ParsedResult {
  request: TreeNode;
  response: TreeNode;
  error?: string;
}
