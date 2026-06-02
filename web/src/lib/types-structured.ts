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

export interface RoleStyle {
  /** Tailwind class for the left border accent (arbitrary value). */
  border: string;
  /** Tailwind class for the body background tint. */
  bg: string;
  /** Hex color used for the dot itself. */
  dot: string;
  /** rgba glow color for the dot. */
  glow: string;
  /** Tailwind class for the header background tint. */
  headerBg: string;
  /** Tailwind class for the header text color. */
  headerText: string;
}

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

// Light theme palette (mirrors index.css :root)
const C = {
  blue: '#2563eb',
  green: '#3d8c2e',
  amber: '#b08020',
  violet: '#7c3aed',
  orange: '#c46a1a',
  red: '#dc2626',
  cyan: '#0e8a7e',
} as const;

export const ROLE_STYLES: Record<string, RoleStyle> = {
  user: {
    border: 'border-l-[rgba(37,99,235,0.4)]',
    bg: 'bg-[rgba(37,99,235,0.04)]',
    dot: C.blue,
    glow: 'rgba(37,99,235,0.25)',
    headerBg: 'bg-[rgba(37,99,235,0.06)]',
    headerText: 'text-c-blue',
  },
  assistant: {
    border: 'border-l-[rgba(124,58,237,0.4)]',
    bg: 'bg-[rgba(124,58,237,0.04)]',
    dot: C.violet,
    glow: 'rgba(124,58,237,0.25)',
    headerBg: 'bg-[rgba(124,58,237,0.06)]',
    headerText: 'text-c-violet',
  },
  system: {
    border: 'border-l-[rgba(37,99,235,0.4)]',
    bg: 'bg-[rgba(37,99,235,0.04)]',
    dot: C.blue,
    glow: 'rgba(37,99,235,0.25)',
    headerBg: 'bg-[rgba(37,99,235,0.06)]',
    headerText: 'text-c-blue',
  },
  tool: {
    border: 'border-l-[rgba(196,106,26,0.4)]',
    bg: 'bg-[rgba(196,106,26,0.04)]',
    dot: C.orange,
    glow: 'rgba(196,106,26,0.25)',
    headerBg: 'bg-[rgba(196,106,26,0.06)]',
    headerText: 'text-c-orange',
  },
  'tool-rsp': {
    border: 'border-l-[rgba(14,138,126,0.4)]',
    bg: 'bg-[rgba(14,138,126,0.04)]',
    dot: C.cyan,
    glow: 'rgba(14,138,126,0.25)',
    headerBg: 'bg-[rgba(14,138,126,0.06)]',
    headerText: 'text-c-cyan',
  },
  error: {
    border: 'border-l-[rgba(220,38,38,0.4)]',
    bg: 'bg-[rgba(220,38,38,0.06)]',
    dot: C.red,
    glow: 'rgba(220,38,38,0.25)',
    headerBg: 'bg-[rgba(220,38,38,0.06)]',
    headerText: 'text-c-red',
  },
  thinking: {
    border: 'border-l-[rgba(176,128,32,0.4)]',
    bg: 'bg-[rgba(176,128,32,0.04)]',
    dot: C.amber,
    glow: 'rgba(176,128,32,0.25)',
    headerBg: 'bg-[rgba(176,128,32,0.06)]',
    headerText: 'text-c-amber',
  },
  generic: {
    border: 'border-l-[var(--text-2)]',
    bg: 'bg-[var(--bg-1)]',
    dot: '#888883',
    glow: 'rgba(136,136,131,0.15)',
    headerBg: 'bg-[var(--bg-1)]',
    headerText: 'text-[var(--text-1)]',
  },
  root: {
    border: 'border-l-[var(--text-2)]',
    bg: '',
    dot: '#888883',
    glow: 'rgba(136,136,131,0.15)',
    headerBg: '',
    headerText: 'text-[var(--text-1)]',
  },
};

export const TYPE_ICONS: Record<BoxType, string> = {
  root: '',
  system: '',
  message: '',
  'content-block': '',
  'tool-call': '',
  'tool-result': '',
  thinking: '',
  error: '',
  generic: '',
};

export function getRoleIcon(_type: BoxType, _role?: Role): string {
  return '';
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
  finishReason?: string;
  error?: string;
}
