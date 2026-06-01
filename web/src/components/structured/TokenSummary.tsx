import { memo } from 'react';
import { formatCost, formatTokens, formatDuration } from '@/lib/utils';

interface TokenSummaryProps {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCost: number | null;
  durationMs: number;
}

export const TokenSummary = memo(function TokenSummary({
  inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens,
  totalCost, durationMs,
}: TokenSummaryProps) {
  const metrics = [
    { label: 'Input', value: formatTokens(inputTokens), show: inputTokens > 0 },
    { label: 'Output', value: formatTokens(outputTokens), show: outputTokens > 0 },
    { label: 'Cache Read', value: formatTokens(cacheReadTokens), show: cacheReadTokens > 0 },
    { label: 'Cache Write', value: formatTokens(cacheWriteTokens), show: cacheWriteTokens > 0 },
    { label: 'Cost', value: formatCost(totalCost), show: totalCost != null },
    { label: 'Duration', value: formatDuration(durationMs), show: durationMs > 0 },
  ];

  const visible = metrics.filter(m => m.show);

  return (
    <div className="rounded-lg bg-[var(--color-surface-raised)] border border-border px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {visible.map((m, i) => (
          <div key={m.label} className="flex items-baseline gap-1.5">
            <span className="text-[var(--text-micro)] uppercase tracking-wide text-[var(--color-text-tertiary)]">
              {m.label}
            </span>
            <span className="text-sm font-medium text-foreground tabular-nums">{m.value}</span>
            {i < visible.length - 1 && (
              <span className="text-[var(--color-separator)] ml-1">|</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
