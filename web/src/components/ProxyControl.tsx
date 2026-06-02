import { useState, useRef, useEffect } from 'react';
import { usePolling } from '@/hooks/usePolling';
import { fetchStatus, proxyStart, proxyStop } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function ProxyControl() {
  const { data: status, refresh } = usePolling(fetchStatus, 2000);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justToggled, setJustToggled] = useState(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); }, []);

  const running = status?.proxy_running ?? false;

  const handleToggle = async () => {
    setActing(true);
    setError(null);
    try {
      if (running) {
        await proxyStop();
      } else {
        await proxyStart();
      }
      refresh();
      setJustToggled(true);
      setTimeout(() => setJustToggled(false), 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Action failed';
      setError(msg);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(null), 3000);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {error && (
        <span className="text-xs text-c-red animate-badge-in font-mono">{error}</span>
      )}
      <div className="flex items-center gap-2">
        <span className="relative flex items-center gap-1.5 text-sm">
          {running ? (
            <>
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-c-green opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-c-green" />
              </span>
              <span className={`hidden sm:inline text-c-green transition-all duration-200 font-mono text-[11px] uppercase tracking-wider ${justToggled ? 'animate-badge-in' : ''}`}>Live</span>
            </>
          ) : (
            <>
              <span className="inline-flex h-2 w-2 rounded-full bg-[var(--text-2)]" aria-hidden="true" />
              <span className="hidden sm:inline text-[var(--text-2)] transition-opacity duration-200 font-mono text-[11px] uppercase tracking-wider">Stopped</span>
            </>
          )}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={acting || !status}
      >
        {acting ? '...' : running ? 'Stop' : 'Start'}
      </Button>
    </div>
  );
}
