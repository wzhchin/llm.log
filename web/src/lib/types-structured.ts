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

// Viewer palette (mirrors index.css :root)
const C = {
  blue: '#6ba4f8',
  green: '#7eb85c',
  amber: '#d4a853',
  violet: '#b392f0',
  orange: '#e0964a',
  red: '#e05555',
} as const;

export const ROLE_STYLES: Record<string, RoleStyle> = {
  user: {
    border: 'border-l-[rgba(107,164,248,0.4)]',
    bg: 'bg-[rgba(107,164,248,0.05)]',
    dot: C.blue,
    glow: 'rgba(107,164,248,0.35)',
    headerBg: 'bg-[rgba(107,164,248,0.06)]',
    headerText: 'text-c-blue',
  },
  assistant: {
    border: 'border-l-[rgba(179,146,240,0.4)]',
    bg: 'bg-[rgba(179,146,240,0.05)]',
    dot: C.violet,
    glow: 'rgba(179,146,240,0.35)',
    headerBg: 'bg-[rgba(179,146,240,0.06)]',
    headerText: 'text-c-violet',
  },
  system: {
    border: 'border-l-[rgba(107,164,248,0.4)]',
    bg: 'bg-[rgba(107,164,248,0.05)]',
    dot: C.blue,
    glow: 'rgba(107,164,248,0.35)',
    headerBg: 'bg-[rgba(107,164,248,0.06)]',
    headerText: 'text-c-blue',
  },
  tool: {
    border: 'border-l-[rgba(224,150,74,0.4)]',
    bg: 'bg-[rgba(224,150,74,0.05)]',
    dot: C.orange,
    glow: 'rgba(224,150,74,0.35)',
    headerBg: 'bg-[rgba(224,150,74,0.06)]',
    headerText: 'text-c-orange',
  },
  error: {
    border: 'border-l-[rgba(224,85,85,0.5)]',
    bg: 'bg-[rgba(224,85,85,0.1)]',
    dot: C.red,
    glow: 'rgba(224,85,85,0.4)',
    headerBg: 'bg-[rgba(224,85,85,0.08)]',
    headerText: 'text-c-red',
  },
  thinking: {
    border: 'border-l-[rgba(212,168,83,0.4)]',
    bg: 'bg-[rgba(212,168,83,0.05)]',
    dot: C.amber,
    glow: 'rgba(212,168,83,0.35)',
    headerBg: 'bg-[rgba(212,168,83,0.06)]',
    headerText: 'text-c-amber',
  },
  generic: {
    border: 'border-l-[var(--text-2)]',
    bg: 'bg-[var(--bg-1)]',
    dot: '#71717a',
    glow: 'rgba(113,113,138,0.2)',
    headerBg: 'bg-[var(--bg-1)]',
    headerText: 'text-[var(--text-1)]',
  },
  root: {
    border: 'border-l-[var(--text-2)]',
    bg: '',
    dot: '#71717a',
    glow: 'rgba(113,113,138,0.2)',
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
