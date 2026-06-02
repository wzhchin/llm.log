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

  const isToolCall = node.type === 'tool-call';
  const isToolResult = node.type === 'tool-result';
  const isToolDef = node.type === 'tool-def';
  const isTool = isToolCall || isToolResult;

  // Determine if this content should use raw markdown formatting
  // Only system and assistant messages get markdown; tools get plain text
  const useMarkdown = node.role === 'assistant' || node.role === 'system' || node.type === 'thinking';

  // Resolve style key
  const styleKey = node.type === 'thinking' ? 'thinking'
    : node.type === 'error' ? 'error'
    : isToolCall ? 'tool'
    : isToolResult ? 'tool-rsp'
    : node.role ?? 'generic';
  const style = ROLE_STYLES[styleKey] ?? ROLE_STYLES.generic;

  const dataRole = styleKey === 'thinking' ? 'assistant'
    : styleKey === 'error' ? 'tool'
    : styleKey === 'tool' ? 'tool'
    : styleKey === 'tool-rsp' ? 'tool-rsp'
    : node.role ?? 'system';

  const handleHeaderClick = useCallback(() => {
    if (isCollapsible) onToggleCollapse(node.id);
  }, [isCollapsible, node.id, onToggleCollapse]);

  // Tool-def metadata
  const toolDesc = isToolDef ? String(node.metadata?.description ?? '') : '';
  const toolSchema = isToolDef ? String(node.metadata?.input_schema ?? '') : '';

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

        {/* Tool call: type tag + name + id — flat, no nesting */}
        {isToolCall && (
          <>
            <span className="text-[var(--c-orange)]">tool_call</span>
            <span className="text-[var(--text-3)]">·</span>
            <span className="text-foreground">{node.metadata?.name || 'tool'}</span>
            {node.metadata?.id && (
              <>
                <span className="text-[var(--text-3)]">·</span>
                <span className="text-[var(--text-3)]">{String(node.metadata.id).slice(0, 12)}</span>
              </>
            )}
          </>
        )}

        {/* Tool result: type tag + id */}
        {isToolResult && (
          <>
            <span className="text-[var(--c-cyan)]">tool_rsp</span>
            {node.metadata?.tool_use_id && (
              <>
                <span className="text-[var(--text-3)]">·</span>
                <span className="text-[var(--text-3)]">{String(node.metadata.tool_use_id).slice(0, 12)}</span>
              </>
            )}
          </>
        )}

        {/* Tool definition: label (contains name with 🔨/🛠️ icon) */}
        {isToolDef && (
          <span className="text-foreground">{node.label}</span>
        )}

        {/* Message/system: role · rawLabel · id */}
        {!isTool && !isToolDef && (
          <>
            {index !== undefined && (
              <span className="msg-hd-idx">[{index}]</span>
            )}
            {node.role && (
              <span style={{ color: style.dot }}>{node.role}</span>
            )}
            <span className="text-[var(--text-2)]">{node.rawLabel}</span>
            {(node.metadata?.id || node.metadata?.call_id) && (
              <>
                <span className="text-[var(--text-3)]">·</span>
                <span className="text-[var(--text-3)]">
                  {String(node.metadata?.id || node.metadata?.call_id).slice(0, 12)}
                </span>
              </>
            )}
          </>
        )}

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
          {/* Tool call: JSON args as plain pre */}
          {hasContent && isToolCall && (
            <pre className="overflow-x-auto rounded bg-[var(--bg-input)] p-3 text-[13px] font-mono leading-relaxed whitespace-pre-wrap break-all border border-[var(--border-0)]">
              <code className="text-foreground">{node.text}</code>
            </pre>
          )}

          {/* Tool result: plain text */}
          {hasContent && isToolResult && (
            <pre className="whitespace-pre-wrap break-words text-[13px] font-mono leading-relaxed text-[var(--text-1)]">
              {node.text}
            </pre>
          )}

          {/* Tool definition: description + schema */}
          {isToolDef && (toolDesc || toolSchema) && (
            <div className="space-y-2">
              {toolDesc && (
                <p className="text-[13px] text-[var(--text-1)]">{toolDesc}</p>
              )}
              {toolSchema && (
                <pre className="overflow-x-auto rounded bg-[var(--bg-input)] p-3 text-[13px] font-mono leading-relaxed whitespace-pre-wrap break-all border border-[var(--border-0)]">
                  <code className="text-foreground">{toolSchema}</code>
                </pre>
              )}
            </div>
          )}

          {/* System / assistant / thinking: markdown formatting */}
          {hasContent && !isTool && !isToolDef && (
            <MarkdownContent
              text={node.text}
              imageUrl={node.imageUrl}
              isBase64Image={node.isBase64Image}
              fileName={node.fileName}
              fileType={node.fileType}
              useMarkdown={useMarkdown}
            />
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
