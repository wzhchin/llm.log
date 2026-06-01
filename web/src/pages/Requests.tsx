import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowUpIcon, ArrowDownIcon, ExternalLinkIcon, Loader2Icon, ChevronLeftIcon, ChevronRightIcon, Maximize2Icon, XIcon } from 'lucide-react';
import { CopyableValue } from '@/components/CopyableValue';
import { DateRangePicker } from '@/components/DateRangePicker';
import { FilterBar } from '@/components/FilterBar';
import { JsonViewer } from '@/components/JsonViewer';
import { EmptyState } from '@/components/EmptyState';
import { useTimeRange } from '@/hooks/useTimeRange';
import { useFilters } from '@/hooks/useFilters';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { fetchRequests, fetchRequestDetail } from '@/lib/api';
import { formatCost, formatTokens, formatDuration, formatDate } from '@/lib/utils';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { RequestItem, RequestDetailResponse } from '@/lib/types';

const COLUMNS = [
  { key: 'timestamp', label: 'Time', hiddenOnMobile: false },
  { key: 'provider', label: 'Provider', hiddenOnMobile: false },
  { key: 'model', label: 'Model', hiddenOnMobile: false },
  { key: 'source', label: 'Source', hiddenOnMobile: true },
  { key: 'input_tokens', label: 'Input', hiddenOnMobile: true },
  { key: 'output_tokens', label: 'Output', hiddenOnMobile: true },
  { key: 'total_cost', label: 'Cost', hiddenOnMobile: false },
  { key: 'duration_ms', label: 'Duration', hiddenOnMobile: true },
  { key: 'status_code', label: 'Status', hiddenOnMobile: false },
];

const NUMERIC_COLUMNS = new Set(['input_tokens', 'output_tokens', 'total_cost', 'duration_ms']);
const PAGE_SIZE_OPTIONS = [25, 50, 100];

function SortArrow({ column, sort, dir }: { column: string; sort: string; dir: string }) {
  if (sort !== column) return null;
  return dir === 'asc' ? (
    <ArrowUpIcon className="inline size-3.5 ml-1" />
  ) : (
    <ArrowDownIcon className="inline size-3.5 ml-1" />
  );
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

// ─── Shared detail panel content ───────────────────────────────────────

function DetailContent({
  detail,
  detailLoading,
  onClose,
}: {
  detail: RequestDetailResponse | null;
  detailLoading: boolean;
  onClose?: () => void;
}) {
  if (detailLoading || !detail) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Fixed header area */}
      <div className="flex-none border-b border-[var(--color-separator)] p-4">
        {/* Header row */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground truncate">
                <CopyableValue value={detail.model} className="text-foreground text-lg font-semibold" />
              </h2>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium tabular-nums shrink-0 ${
                detail.status_code >= 400 ? 'bg-red-400/10 text-red-400' : 'bg-emerald-400/10 text-emerald-400'
              }`}>
                {detail.status_code}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] mt-1">
              <CopyableValue value={detail.provider} className="text-xs text-[var(--color-text-secondary)]" />
              <span className="text-[var(--color-text-tertiary)]">·</span>
              <span>{formatDate(detail.timestamp)}</span>
              <span className="text-[var(--color-text-tertiary)]">·</span>
              <span>{detail.streaming ? 'Streaming' : 'Non-streaming'}</span>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close detail">
              <XIcon className="size-4" />
            </Button>
          )}
        </div>

        {/* Metrics strip */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 py-3 mt-3 border-t border-[var(--color-separator)]">
          {[
            { label: 'Input', value: formatTokens(detail.input_tokens), raw: String(detail.input_tokens) },
            { label: 'Output', value: formatTokens(detail.output_tokens), raw: String(detail.output_tokens) },
            { label: 'Cost', value: formatCost(detail.total_cost), raw: detail.total_cost !== null ? String(detail.total_cost) : 'N/A' },
            { label: 'Duration', value: formatDuration(detail.duration_ms), raw: `${detail.duration_ms}ms` },
          ].map(m => (
            <div key={m.label} className="flex items-baseline gap-1.5">
              <span className="text-[var(--text-micro)] uppercase tracking-wide text-[var(--color-text-tertiary)]">{m.label}</span>
              <CopyableValue value={m.raw} display={m.value} className="text-sm font-medium text-foreground tabular-nums" />
            </div>
          ))}
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs pt-3 border-t border-[var(--color-separator)]">
          <span className="text-[var(--color-text-tertiary)]">Endpoint</span>
          <CopyableValue value={detail.endpoint} className="text-xs text-foreground truncate" mono />
          <span className="text-[var(--color-text-tertiary)]">Source</span>
          <CopyableValue value={detail.source || '—'} className="text-xs text-foreground" />
          <span className="text-[var(--color-text-tertiary)]">ID</span>
          <CopyableValue value={String(detail.id)} className="text-xs text-foreground" mono />
        </div>

        {/* Open full view link */}
        <div className="mt-3">
          <a
            href={`/requests/${detail.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-foreground transition-colors"
          >
            <ExternalLinkIcon className="size-3" />
            Open full view
          </a>
        </div>
      </div>

      {/* Scrollable body tabs */}
      <div className="flex-1 overflow-y-auto p-4 pt-0">
        <div className="mt-4">
          <Tabs defaultValue="request">
            <TabsList>
              <TabsTrigger value="request">Request</TabsTrigger>
              <TabsTrigger value="response">Response</TabsTrigger>
            </TabsList>
            <TabsContent value="request" className="mt-3">
              <JsonViewer data={detail.request_body || '{}'} />
            </TabsContent>
            <TabsContent value="response" className="mt-3">
              <JsonViewer data={detail.response_body || '{}'} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────

export function Requests() {
  const { range } = useTimeRange();
  const filters = useFilters();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [viewMode, setViewMode] = useState<'table' | 'split'>('table');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RequestDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ─── Table mode state (unchanged) ──────────────────────────────────
  const [items, setItems] = useState<RequestItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const [pageCursors, setPageCursors] = useState<string[]>(['']);
  const [nextCursor, setNextCursor] = useState('');

  // ─── Split mode: infinite scroll ───────────────────────────────────
  const infiniteParams = useMemo(
    () => ({ ...filters.params, from: range.from, to: range.to, limit: 50 }),
    [filters.params, range.from, range.to],
  );
  const infiniteKey = useMemo(
    () => JSON.stringify(infiniteParams),
    [infiniteParams],
  );

  const {
    items: listItems,
    loading: listLoading,
    initialLoading: listInitialLoading,
    sentinelRef,
    hasMore,
  } = useInfiniteScroll<RequestItem>(
    fetchRequests,
    infiniteParams,
    [infiniteKey],
  );

  // ─── Table mode effects (unchanged) ────────────────────────────────
  const paramsKey = useMemo(
    () => JSON.stringify({ ...filters.params, from: range.from, to: range.to }),
    [filters.params, range.from, range.to],
  );

  useEffect(() => {
    setPage(0);
    setPageCursors(['']);
    setNextCursor('');
  }, [paramsKey, pageSize]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const cursor = pageCursors[page] ?? '';
      try {
        const res = await fetchRequests({
          ...filters.params,
          from: range.from,
          to: range.to,
          limit: pageSize,
          cursor: cursor || undefined,
        });
        if (!cancelled) {
          setItems(res.items);
          setTotal(res.total);
          setNextCursor(res.next_cursor);
          if (res.next_cursor) {
            setPageCursors(prev => {
              const next = [...prev];
              next[page + 1] = res.next_cursor;
              return next;
            });
          }
        }
      } catch {
        if (!cancelled) setError('Failed to load requests');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [paramsKey, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = total !== null ? Math.ceil(total / pageSize) : null;
  const hasNext = !!nextCursor;
  const hasPrev = page > 0;
  const goNext = useCallback(() => { if (hasNext) setPage(p => p + 1); }, [hasNext]);
  const goPrev = useCallback(() => { if (hasPrev) setPage(p => p - 1); }, [hasPrev]);
  const showFrom = page * pageSize + 1;
  const showTo = page * pageSize + items.length;

  // ─── Detail fetching ───────────────────────────────────────────────
  useEffect(() => {
    if (selectedId === null) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    fetchRequestDetail(selectedId)
      .then((res) => { if (!cancelled) setDetail(res); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  // ─── Handlers ──────────────────────────────────────────────────────
  const handleRowClick = useCallback((id: number) => {
    setSelectedId(id);
    if (isDesktop) {
      setViewMode('split');
    }
  }, [isDesktop]);

  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
    setViewMode('table');
  }, []);

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 animate-stagger">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Requests</h1>
          <DateRangePicker />
        </div>
        <FilterBar filters={filters} />
      </div>

      {/* ─── Table mode ────────────────────────────────────────────── */}
      {viewMode === 'table' && (
        <>
          {error ? (
            <EmptyState
              icon={<span className="text-5xl">⚡</span>}
              title="Connection hiccup"
              description="Couldn't reach the server. It might be taking a nap."
              action={<Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>}
            />
          ) : loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<span className="text-5xl">🔍</span>}
              title="No requests found"
              description="Try widening your filters or picking a different time range."
            />
          ) : (
            <>
              <div className="overflow-x-auto" data-chameleon-perch>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      {COLUMNS.map((col) => (
                        <TableHead
                          key={col.key}
                          className={`cursor-pointer select-none text-xs text-[var(--color-text-secondary)] hover:text-foreground transition-colors ${NUMERIC_COLUMNS.has(col.key) ? 'text-right' : ''} ${col.hiddenOnMobile ? 'hidden sm:table-cell' : ''}`}
                          aria-sort={filters.sort === col.key ? (filters.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                          onClick={() => filters.toggleSort(col.key)}
                        >
                          {col.label}
                          <SortArrow column={col.key} sort={filters.sort} dir={filters.dir} />
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow
                        key={item.id}
                        tabIndex={0}
                        className="cursor-pointer border-border hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-muted-foreground even:bg-[var(--color-surface-raised)]"
                        onClick={() => handleRowClick(item.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(item.id); } }}
                      >
                        <TableCell className="text-xs text-foreground">{formatDate(item.timestamp)}</TableCell>
                        <TableCell className="text-xs text-foreground max-w-28 truncate">{item.provider}</TableCell>
                        <TableCell className="text-xs text-foreground max-w-48 truncate">{item.model}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-[var(--color-text-secondary)] max-w-32 truncate">{item.source}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-[var(--color-text-secondary)] tabular-nums text-right">{formatTokens(item.input_tokens)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-[var(--color-text-secondary)] tabular-nums text-right">{formatTokens(item.output_tokens)}</TableCell>
                        <TableCell className="text-xs text-foreground tabular-nums text-right">{formatCost(item.total_cost)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-[var(--color-text-secondary)] tabular-nums text-right">{formatDuration(item.duration_ms)}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                              item.status_code >= 400 ? 'bg-red-400' : item.status_code >= 300 ? 'bg-amber-400' : 'bg-emerald-400'
                            }`} />
                            <span className="tabular-nums text-xs">{item.status_code}</span>
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination controls */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <span className="hidden sm:inline">Rows per page</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(val) => setPageSize(Number(val))}
                  >
                    <SelectTrigger className="h-7 w-[70px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map(n => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
                    {total !== null
                      ? `${showFrom}–${showTo} of ${total}`
                      : `${showFrom}–${showTo}`}
                    {!hasNext && items.length > 0 && (
                      <span className="text-xs text-[var(--color-text-tertiary)] ml-2">· That's all!</span>
                    )}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={!hasPrev}
                      onClick={goPrev}
                      aria-label="Previous page"
                    >
                      <ChevronLeftIcon className="size-4" />
                    </Button>
                    {totalPages !== null && (
                      <span className="flex items-center px-1 text-xs text-[var(--color-text-tertiary)] tabular-nums">
                        {page + 1} / {totalPages}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={!hasNext}
                      onClick={goNext}
                      aria-label="Next page"
                    >
                      <ChevronRightIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ─── Split mode (desktop only) ──────────────────────────────── */}
      {viewMode === 'split' && (
        <div className="flex gap-0 h-[calc(100vh-12rem)] -m-6 lg:-m-8 p-6 lg:p-8">
          {/* Left panel — compact list */}
          <div className="flex flex-col w-2/5 min-w-0 border-r border-[var(--color-separator)]">
            {/* List header */}
            <div className="flex-none flex items-center justify-between px-3 py-2 border-b border-[var(--color-separator)]">
              <span className="text-sm font-medium text-foreground">Requests</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCloseDetail}
                aria-label="Expand to table view"
                title="Expand to table view"
              >
                <Maximize2Icon className="size-4" />
              </Button>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto">
              {listInitialLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : listItems.length === 0 ? (
                <EmptyState
                  icon={<span className="text-4xl">🔍</span>}
                  title="No requests found"
                  description="Try widening your filters."
                />
              ) : (
                <div role="listbox" aria-label="Request list">
                  {listItems.map((item) => (
                    <CompactListItem
                      key={item.id}
                      item={item}
                      isSelected={selectedId === item.id}
                      onClick={() => setSelectedId(item.id)}
                    />
                  ))}
                  {/* Infinite scroll sentinel */}
                  {hasMore && (
                    <div ref={sentinelRef} className="h-1" />
                  )}
                  {listLoading && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right panel — detail view */}
          <div className="flex-1 min-w-0 animate-slide-in-right">
            <DetailContent
              detail={detail}
              detailLoading={detailLoading}
              onClose={handleCloseDetail}
            />
          </div>
        </div>
      )}

      {/* ─── Mobile Dialog (unchanged) ──────────────────────────────── */}
      <Dialog
        open={selectedId !== null && !isDesktop}
        onOpenChange={(open) => { if (!open) setSelectedId(null); }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto p-6">
          <DetailContent detail={detail} detailLoading={detailLoading} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Compact list item for split view ────────────────────────────────

function CompactListItem({
  item,
  isSelected,
  onClick,
}: {
  item: RequestItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={onClick}
      className={`w-full text-left px-3 py-2 border-b border-[var(--color-separator)] cursor-pointer transition-colors ${
        isSelected
          ? 'bg-[var(--color-surface-raised)] border-l-2 border-l-[var(--accent-provider)]'
          : 'hover:bg-[var(--color-surface-hover)] border-l-2 border-l-transparent'
      }`}
    >
      {/* Row 1: Time · Provider · Model · Source */}
      <div className="flex items-center gap-1.5 text-xs text-foreground truncate">
        <span className="shrink-0 text-[var(--color-text-secondary)] tabular-nums">{formatDate(item.timestamp)}</span>
        <span className="text-[var(--color-text-tertiary)]">·</span>
        <span className="truncate">{item.provider}</span>
        <span className="text-[var(--color-text-tertiary)]">·</span>
        <span className="truncate">{item.model}</span>
        {item.source && (
          <>
            <span className="text-[var(--color-text-tertiary)]">·</span>
            <span className="truncate text-[var(--color-text-secondary)]">{item.source}</span>
          </>
        )}
      </div>
      {/* Row 2: Input · Output · Cost · Duration · Status */}
      <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--color-text-secondary)]">
        <span className="tabular-nums">{formatTokens(item.input_tokens)} in</span>
        <span className="tabular-nums">{formatTokens(item.output_tokens)} out</span>
        <span className="tabular-nums">{formatCost(item.total_cost)}</span>
        <span className="tabular-nums">{formatDuration(item.duration_ms)}</span>
        <span className="ml-auto flex items-center gap-1 shrink-0">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${
            item.status_code >= 400 ? 'bg-red-400' : item.status_code >= 300 ? 'bg-amber-400' : 'bg-emerald-400'
          }`} />
          <span className="tabular-nums">{item.status_code}</span>
        </span>
      </div>
    </button>
  );
}
