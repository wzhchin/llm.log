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
    <div className="metric-grid">
      {visible.map(m => (
        <div key={m.label} className="metric-card">
          <div className="metric-card-label">{m.label}</div>
          <div className="metric-card-value">{m.value}</div>
        </div>
      ))}
    </div>
  );
});
