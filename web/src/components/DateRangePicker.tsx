import { useTimeRange } from '@/hooks/useTimeRange';
import { Input } from '@/components/ui/input';
import { Slider } from '@base-ui/react/slider';

const MAX_LOOKBACK_MINUTES = 30 * 24 * 60; // 30 days

function toLocalDatetime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateRangePicker() {
  const { range, setCustom } = useTimeRange();

  const now = Date.now();
  const fromMs = new Date(range.from).getTime();
  const toMs = new Date(range.to).getTime();

  // Slider value: minutes-ago from now (0 = now, higher = further back)
  const fromAgo = Math.round((now - fromMs) / 60000);
  const toAgo = Math.round((now - toMs) / 60000);

  const handleSliderChange = (value: number | number[]) => {
    const [lo, hi] = value as number[];
    // lo = closer to now (to), hi = further back (from)
    const newFrom = new Date(now - hi * 60000).toISOString();
    const newTo = new Date(now - lo * 60000).toISOString();
    setCustom(newFrom, newTo);
  };

  return (
    <div className="flex items-center gap-3">
      <Slider.Root
        value={[toAgo, fromAgo]}
        onValueChange={handleSliderChange}
        min={0}
        max={MAX_LOOKBACK_MINUTES}
        step={60}
        className="relative flex w-44 items-center h-5 touch-none select-none"
      >
        <Slider.Track className="relative h-1 w-full rounded-full bg-[var(--bg-3)]">
          <Slider.Indicator className="absolute h-full rounded-full bg-[var(--c-amber)]" />
        </Slider.Track>
        <Slider.Thumb className="block size-3 rounded-full bg-[var(--c-amber)] shadow-sm border border-[var(--border-0)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-amber-dim)]/50" />
        <Slider.Thumb className="block size-3 rounded-full bg-[var(--c-amber)] shadow-sm border border-[var(--border-0)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-amber-dim)]/50" />
      </Slider.Root>

      <div className="flex items-center gap-1.5">
        <Input
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
