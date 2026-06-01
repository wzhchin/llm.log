import { useState, useEffect, useCallback, useRef } from 'react';

interface InfiniteScrollResult<T> {
  items: T[];
  loading: boolean;
  initialLoading: boolean;
  error: string | null;
  hasMore: boolean;
  sentinelRef: (node: HTMLDivElement | null) => void;
  reset: () => void;
}

export function useInfiniteScroll<T>(
  fetchFn: (params: Record<string, unknown>) => Promise<{ items: T[]; next_cursor: string }>,
  baseParams: Record<string, unknown>,
  deps: unknown[] = [],
): InfiniteScrollResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const cursorRef = useRef('');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelNodeRef = useRef<HTMLDivElement | null>(null);

  // Keep refs in sync
  loadingRef.current = loading;
  hasMoreRef.current = hasMore;
  cursorRef.current = cursor;

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFn({
        ...baseParams,
        cursor: cursorRef.current || undefined,
      });
      setItems((prev: T[]) => cursorRef.current ? [...prev, ...res.items] : res.items);
      setCursor(res.next_cursor || '');
      setHasMore(!!res.next_cursor);
    } catch {
      setError('Failed to load items');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [fetchFn, baseParams]);

  const reset = useCallback(() => {
    setItems([]);
    setCursor('');
    setHasMore(true);
    setError(null);
    setInitialLoading(true);
  }, []);

  // Reset and initial load when deps change
  useEffect(() => {
    reset();
  }, [...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load after reset
  useEffect(() => {
    if (items.length === 0 && initialLoading && hasMore) {
      loadMore();
    }
  }, [items.length, initialLoading, hasMore, loadMore]);

  // Intersection Observer callback
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    sentinelNodeRef.current = node;

    if (!node) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingRef.current && hasMoreRef.current) {
          loadMore();
        }
      },
      { rootMargin: '200px' },
    );
    observerRef.current.observe(node);
  }, [loadMore]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return { items, loading, initialLoading, error, hasMore, sentinelRef, reset };
}
