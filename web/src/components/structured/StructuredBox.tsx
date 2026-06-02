import { memo, useCallback } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';
import type { TreeNode } from '@/lib/types-structured';
import { ROLE_STYLES } from '@/lib/types-structured';

interface StructuredBoxProps {
  node: TreeNode;
  collapsedBoxes: Set<string>;
  onToggleCollapse: (id: string) => void;
  index?: number;
}

export const StructuredBox = memo(function StructuredBox({
  node, collapsedBoxes, onToggleCollapse, index,
}: StructuredBoxProps) {
  const isCollapsed = collapsedBoxes.has(node.id);
  const hasChildren = node.children.length > 0;
  const hasContent = !!(node.text || node.imageUrl || node.isBase64Image || node.fileName);
  const isCollapsible = hasChildren || hasContent;

  // Resolve style key: tool-call → orange, tool-result → cyan
  const styleKey = node.type === 'thinking' ? 'thinking'
    : node.type === 'error' ? 'error'
    : node.type === 'tool-call' ? 'tool'
    : node.type === 'tool-result' ? 'tool-rsp'
    : node.role ?? 'generic';
  const style = ROLE_STYLES[styleKey] ?? ROLE_STYLES.generic;

  const isToolCall = node.type === 'tool-call';
  const isMessage = node.type === 'message' || node.type === 'system';

  // Map style key to viewer.html data-r attribute
  const dataRole = styleKey === 'thinking' ? 'assistant'
    : styleKey === 'error' ? 'tool'
    : styleKey === 'tool' ? 'tool'
    : styleKey === 'tool-rsp' ? 'tool-rsp'
    : node.role ?? 'system';

  const handleHeaderClick = useCallback(() => {
    if (isCollapsible) onToggleCollapse(node.id);
  }, [isCollapsible, node.id, onToggleCollapse]);

  // Build label parts: role + rawLabel + id
  const buildLabel = () => {
    const parts: React.ReactNode[] = [];

    // Role prefix
    if (node.role) {
      const roleColors: Record<string, string> = {
        user: 'var(--c-blue)',
        assistant: 'var(--c-violet)',
        system: 'var(--c-blue)',
        tool: 'var(--c-orange)',
      };
      const color = roleColors[node.role] ?? 'var(--text-1)';
      parts.push(
        <span key="role" style={{ color }}>{node.role}</span>
      );
    }

    // rawLabel
    parts.push(
      <span key="raw" className="text-[var(--text-2)]">{node.rawLabel}</span>
    );

    // Tool id from metadata
    const id = node.metadata?.id || node.metadata?.call_id;
    if (id && typeof id === 'string') {
      parts.push(
        <span key="id" className="text-[var(--text-3)]">{id.length > 12 ? id.slice(0, 12) + '…' : id}</span>
      );
    }

    return parts;
  };

  return (
    <div className="msg" data-r={dataRole}>
      <div
        className={`msg-hd ${isCollapsible ? 'cursor-pointer' : ''}`}
        onClick={handleHeaderClick}
      >
        {/* Collapse chevron */}
        {isCollapsible && (
          <span className="section-arrow">
            {isCollapsed
              ? <ChevronRightIcon className="size-3" />
              : <ChevronDownIcon className="size-3" />}
          </span>
        )}

        {/* Dot + glow */}
        <span
          className="section-dot"
          style={{ backgroundColor: style.dot, boxShadow: `0 0 5px ${style.glow}` }}
        />

        {/* Index number for messages */}
        {isMessage && index !== undefined && (
          <span className="msg-hd-idx">[{index}]</span>
        )}

        {/* Label: role · rawLabel · id */}
        {isToolCall && <span style={{ opacity: 0.5 }}>{'λ '}</span>}
        {buildLabel().reduce<React.ReactNode[]>((acc, part, i) =>
          i === 0 ? [part] : [...acc, <span key={`sep-${i}`} className="text-[var(--text-3)]">·</span>, part]
        , [])}

        {/* Badge — child count */}
        {hasChildren && node.children.length > 0 && (
          <span className="section-badge">
            {node.children.length}
          </span>
        )}

        <span className="flex-1" />
      </div>

      {/* Content (hidden when collapsed) */}
      {!isCollapsed && (
        <div className="msg-bd">
          {/* Metadata row */}
          {node.metadata && Object.keys(node.metadata).length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 pb-2 border-b border-[var(--border-0)]">
              {Object.entries(node.metadata).map(([k, v]) => (
                v !== '' && v !== undefined && v !== null ? (
                  <div key={k} className="flex items-baseline gap-1">
                    <span className="text-[10px] text-[var(--text-2)] font-mono uppercase">{k}</span>
                    <span className="text-xs text-foreground font-mono">{String(v)}</span>
                  </div>
                ) : null
              ))}
            </div>
          )}

          {/* Text / image / file content */}
          {hasContent && !isToolCall && (
            <MarkdownContent
              text={node.text}
              imageUrl={node.imageUrl}
              isBase64Image={node.isBase64Image}
              fileName={node.fileName}
              fileType={node.fileType}
            />
          )}

          {/* Tool call block — viewer .tc-block style */}
          {hasContent && isToolCall && (
            <div className="tc-block">
              <div className="tc-hd">
                {node.metadata?.name || 'tool'}
              </div>
              <div className="tc-args">
                <MarkdownContent
                  text={node.text}
                />
              </div>
            </div>
          )}

          {/* Children */}
          {hasChildren && (
            <div className="msg-list mt-2">
              {node.children.map((child, i) => (
                <StructuredBox
                  key={child.id}
                  node={child}
                  collapsedBoxes={collapsedBoxes}
                  onToggleCollapse={onToggleCollapse}
                  index={child.type === 'message' || child.type === 'system' ? i : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
