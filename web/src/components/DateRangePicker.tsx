import { useRef, useCallback, useId } from 'react';
import { useTimeRange } from '@/hooks/useTimeRange';
import { Input } from '@/components/ui/input';

const MAX_LOOKBACK_MINUTES = 30 * 24 * 60; // 30 days

function toLocalDatetime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateRangePicker() {
  const { range, setCustom } = useTimeRange();
  const trackRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const now = Date.now();
  const fromMs = new Date(range.from).getTime();
  const toMs = new Date(range.to).getTime();

  const fromAgo = Math.round((now - fromMs) / 60000);
  const toAgo = Math.round((now - toMs) / 60000);

  // Normalize: lo = closer to now (toAgo), hi = further back (fromAgo)
  const lo = Math.min(fromAgo, toAgo);
  const hi = Math.max(fromAgo, toAgo);

  const updateFromPointer = useCallback(
    (clientX: number, thumb: 'lo' | 'hi') => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const minutes = Math.round((ratio * MAX_LOOKBACK_MINUTES) / 60) * 60; // snap to 1h
      const clamped = Math.max(0, Math.min(MAX_LOOKBACK_MINUTES, minutes));

      const newLo = thumb === 'lo' ? clamped : lo;
      const newHi = thumb === 'hi' ? clamped : hi;

      // lo = toAgo (closer to now), hi = fromAgo (further back)
      const newTo = new Date(now - newLo * 60000).toISOString();
      const newFrom = new Date(now - newHi * 60000).toISOString();
      setCustom(newFrom, newTo);
    },
    [lo, hi, now, setCustom],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent, thumb: 'lo' | 'hi') => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => updateFromPointer(ev.clientX, thumb);
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [updateFromPointer],
  );

  const loPct = (lo / MAX_LOOKBACK_MINUTES) * 100;
  const hiPct = (hi / MAX_LOOKBACK_MINUTES) * 100;

  return (
    <div className="flex items-center gap-3">
      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-2 w-44 flex-shrink-0 rounded-full bg-[var(--bg-3)] touch-none select-none"
      >
        {/* Selected range indicator */}
        <div
          className="absolute top-0 h-full rounded-full bg-[var(--c-amber)]/40"
          style={{ left: `${loPct}%`, width: `${hiPct - loPct}%` }}
        />

        {/* Lo thumb (to / closer to now) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3.5 rounded-full bg-[var(--c-amber)] shadow-sm border border-[var(--border-0)] cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
          style={{ left: `${loPct}%` }}
          onPointerDown={(e) => onPointerDown(e, 'lo')}
          role="slider"
          aria-label="End date"
          aria-valuenow={lo}
          aria-valuemin={0}
          aria-valuemax={MAX_LOOKBACK_MINUTES}
          aria-controls={`${id}-to`}
          tabIndex={0}
        />

        {/* Hi thumb (from / further back) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3.5 rounded-full bg-[var(--c-amber)] shadow-sm border border-[var(--border-0)] cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
          style={{ left: `${hiPct}%` }}
          onPointerDown={(e) => onPointerDown(e, 'hi')}
          role="slider"
          aria-label="Start date"
          aria-valuenow={hi}
          aria-valuemin={0}
          aria-valuemax={MAX_LOOKBACK_MINUTES}
          aria-controls={`${id}-from`}
          tabIndex={0}
        />
      </div>

      {/* Datetime inputs */}
      <div className="flex items-center gap-1.5">
        <Input
          id={`${id}-from`}
          type="datetime-local"
          aria-label="Start date"
          value={toLocalDatetime(range.from)}
          onChange={(e) => {
            const val = e.target.value;
            if (val) setCustom(new Date(val).toISOString(), range.to);
          }}
          className="h-6 w-auto text-[11px] font-mono"
        />
        <span className="text-[var(--text-2)] text-[11px]">→</span>
        <Input
          id={`${id}-to`}
          type="datetime-local"
          aria-label="End date"
          value={toLocalDatetime(range.to)}
          onChange={(e) => {
            const val = e.target.value;
            if (val) setCustom(range.from, new Date(val).toISOString());
          }}
          className="h-6 w-auto text-[11px] font-mono"
        />
      </div>
    </div>
  );
}
