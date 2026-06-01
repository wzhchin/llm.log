import { memo, useCallback } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';
import type { TreeNode } from '@/lib/types-structured';

interface StructuredBoxProps {
  node: TreeNode;
  globalMarkdown: boolean;
  collapsedBoxes: Set<string>;
  boxRawOverrides: Set<string>;
  onToggleCollapse: (id: string) => void;
  onToggleBoxRaw: (id: string) => void;
}

export const StructuredBox = memo(function StructuredBox({
  node, globalMarkdown, collapsedBoxes, boxRawOverrides,
  onToggleCollapse, onToggleBoxRaw,
}: StructuredBoxProps) {
  const isCollapsed = collapsedBoxes.has(node.id);
  const isOverridden = boxRawOverrides.has(node.id);
  const showRaw = isOverridden ? globalMarkdown : !globalMarkdown;
  const hasChildren = node.children.length > 0;
  const hasContent = !!(node.text || node.imageUrl || node.isBase64Image || node.fileName);
  const isCollapsible = hasChildren || hasContent;

  const handleHeaderClick = useCallback(() => {
    if (isCollapsible) onToggleCollapse(node.id);
  }, [isCollapsible, node.id, onToggleCollapse]);

  const handleRawToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleBoxRaw(node.id);
  }, [node.id, onToggleBoxRaw]);

  return (
    <div className={`rounded-lg border border-border ${node.bgClass} overflow-hidden`}>
      {/* Left color border */}
      <div className={`border-l-2 ${node.borderClass}`}>
        {/* Header */}
        <div
          className={`flex items-center justify-between px-3 py-2 ${isCollapsible ? 'cursor-pointer hover:bg-[var(--color-surface-hover)]' : ''} transition-colors`}
          onClick={handleHeaderClick}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Collapse chevron */}
            {isCollapsible && (
              <span className="text-[var(--color-text-tertiary)] shrink-0">
                {isCollapsed
                  ? <ChevronRightIcon className="size-3.5" />
                  : <ChevronDownIcon className="size-3.5" />}
              </span>
            )}

            {/* Label */}
            {showRaw ? (
              <span className="text-sm text-[var(--color-text-secondary)] font-mono truncate">
                {node.rawLabel}
              </span>
            ) : (
              <span className="text-sm text-foreground font-medium truncate">
                {node.label}
              </span>
            )}
          </div>

          {/* Per-box MD/Raw toggle */}
          {hasContent && (
            <button
              className="text-xs text-[var(--color-text-tertiary)] hover:text-foreground px-2 py-0.5 rounded transition-colors shrink-0"
              onClick={handleRawToggle}
            >
              {showRaw ? 'MD' : 'Raw'}
            </button>
          )}
        </div>

        {/* Content (hidden when collapsed) */}
        {!isCollapsed && (
          <div className="border-t border-border/50">
            {/* Metadata row */}
            {node.metadata && Object.keys(node.metadata).length > 0 && (
              <div className="px-3 py-2 flex flex-wrap gap-x-4 gap-y-1 border-b border-border/30">
                {Object.entries(node.metadata).map(([k, v]) => (
                  v !== '' && v !== undefined && v !== null ? (
                    <div key={k} className="flex items-baseline gap-1">
                      <span className="text-xs text-[var(--color-text-tertiary)]">{k}</span>
                      <span className="text-xs text-foreground font-mono">{String(v)}</span>
                    </div>
                  ) : null
                ))}
              </div>
            )}

            {/* Text / image / file content */}
            {hasContent && (
              <div className="px-3 py-2">
                <MarkdownContent
                  text={node.text}
                  showRaw={showRaw}
                  imageUrl={node.imageUrl}
                  isBase64Image={node.isBase64Image}
                  fileName={node.fileName}
                  fileType={node.fileType}
                />
              </div>
            )}

            {/* Children with connection lines */}
            {hasChildren && (
              <div className="px-3 pb-2">
                <div className="ml-2 pl-4 border-l border-[var(--color-separator)] flex flex-col gap-2">
                  {node.children.map(child => (
                    <StructuredBox
                      key={child.id}
                      node={child}
                      globalMarkdown={globalMarkdown}
                      collapsedBoxes={collapsedBoxes}
                      boxRawOverrides={boxRawOverrides}
                      onToggleCollapse={onToggleCollapse}
                      onToggleBoxRaw={onToggleBoxRaw}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
