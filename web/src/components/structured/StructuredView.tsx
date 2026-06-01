import { useState, useMemo, useCallback } from 'react';
import { parseBodies } from '@/lib/parsers';
import { TokenSummary } from './TokenSummary';
import { StructuredBox } from './StructuredBox';

interface StructuredViewProps {
  requestBody: string;
  responseBody: string;
  endpoint: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCost: number | null;
  durationMs: number;
}

export function StructuredView({
  requestBody, responseBody, endpoint,
  inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens,
  totalCost, durationMs,
}: StructuredViewProps) {
  const [globalMarkdown, setGlobalMarkdown] = useState(true);
  const [collapsedBoxes, setCollapsedBoxes] = useState<Set<string>>(new Set());
  const [boxRawOverrides, setBoxRawOverrides] = useState<Set<string>>(new Set());

  const parsed = useMemo(() => {
    return parseBodies(requestBody, responseBody, endpoint);
  }, [requestBody, responseBody, endpoint]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedBoxes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleBoxRaw = useCallback((id: string) => {
    setBoxRawOverrides(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {/* Token usage summary */}
      <TokenSummary
        inputTokens={inputTokens}
        outputTokens={outputTokens}
        cacheReadTokens={cacheReadTokens}
        cacheWriteTokens={cacheWriteTokens}
        totalCost={totalCost}
        durationMs={durationMs}
      />

      {/* Global MD/Raw toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-text-tertiary)]">Display:</span>
        <button
          className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
            globalMarkdown
              ? 'bg-primary text-primary-foreground'
              : 'text-[var(--color-text-secondary)] hover:text-foreground'
          }`}
          onClick={() => setGlobalMarkdown(true)}
        >
          Markdown
        </button>
        <button
          className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
            !globalMarkdown
              ? 'bg-primary text-primary-foreground'
              : 'text-[var(--color-text-secondary)] hover:text-foreground'
          }`}
          onClick={() => setGlobalMarkdown(false)}
        >
          Raw
        </button>
      </div>

      {/* Parse error */}
      {parsed.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          ⚠️ {parsed.error}
        </div>
      )}

      {/* Request section */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          Request
        </h3>
        <StructuredBox
          node={parsed.request}
          globalMarkdown={globalMarkdown}
          collapsedBoxes={collapsedBoxes}
          boxRawOverrides={boxRawOverrides}
          onToggleCollapse={toggleCollapse}
          onToggleBoxRaw={toggleBoxRaw}
        />
      </div>

      {/* Response section */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          Response
        </h3>
        <StructuredBox
          node={parsed.response}
          globalMarkdown={globalMarkdown}
          collapsedBoxes={collapsedBoxes}
          boxRawOverrides={boxRawOverrides}
          onToggleCollapse={toggleCollapse}
          onToggleBoxRaw={toggleBoxRaw}
        />
      </div>
    </div>
  );
}
