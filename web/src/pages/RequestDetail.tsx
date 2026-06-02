import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Loader2Icon } from 'lucide-react';
import { CopyableValue } from '@/components/CopyableValue';
import { fetchRequestDetail } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/EmptyState';
import { JsonViewer } from '@/components/JsonViewer';
import { StructuredView } from '@/components/structured/StructuredView';
import type { RequestDetailResponse } from '@/lib/types';

function StatusBadge({ code }: { code: number }) {
  if (code >= 200 && code < 300) {
    return (
      <Badge className="bg-c-green/15 text-c-green border-c-green/30">
        {code}
      </Badge>
    );
  }
  if (code >= 400) {
    return (
      <Badge className="bg-c-red/15 text-c-red border-c-red/30">
        {code}
      </Badge>
    );
  }
  return (
    <Badge className="bg-muted text-muted-foreground border-border">
      {code}
    </Badge>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-32">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<RequestDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchRequestDetail(Number(id))
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <>
        <Link to="/requests" className="text-sm text-[var(--color-text-secondary)] hover:text-foreground transition-colors">
          &larr; Back to Requests
        </Link>
        <div className="mt-8">
          <EmptyState
            title="Request not found"
            description={error}
          />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Link to="/requests" className="text-sm text-[var(--color-text-secondary)] hover:text-foreground transition-colors">
          &larr; Back to Requests
        </Link>
        <div className="mt-8">
          <EmptyState
            title="Request not found"
            description="The request you are looking for does not exist."
          />
        </div>
      </>
    );
  }

  return (
    <div className="animate-stagger">
      {/* Back link */}
      <Link
        to="/requests"
        className="text-sm text-[var(--color-text-secondary)] hover:text-foreground transition-colors inline-flex items-center gap-1"
      >
        &larr; Back to Requests
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground break-all">
          <CopyableValue value={data.model} className="text-2xl font-bold text-foreground" />
        </h1>
        <CopyableValue value={data.provider} display={data.provider} className="text-xs" />
        <StatusBadge code={data.status_code} />
        <span className="text-sm text-[var(--color-text-secondary)]">{formatDate(data.timestamp)}</span>
      </div>

      {/* Metadata */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--color-text-secondary)]">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[var(--color-text-tertiary)]">Endpoint</span>
          <CopyableValue value={data.endpoint} className="text-sm text-foreground" mono />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[var(--color-text-tertiary)]">Source</span>
          <CopyableValue value={data.source || '—'} className="text-sm text-foreground" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[var(--color-text-tertiary)]">Streaming</span>
          <span className="text-foreground">{data.streaming ? 'Yes' : 'No'}</span>
        </div>
      </div>

      {/* Body section — tab between Structured View and Raw JSON */}
      <div className="mt-6">
        <Tabs defaultValue="structured">
          <TabsList>
            <TabsTrigger value="structured">Structured View</TabsTrigger>
            <TabsTrigger value="raw">Raw JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="structured" className="mt-4">
            <StructuredView
              requestBody={data.request_body}
              responseBody={data.response_body}
              endpoint={data.endpoint}
              inputTokens={data.input_tokens}
              outputTokens={data.output_tokens}
              cacheReadTokens={data.cache_read_tokens}
              cacheWriteTokens={data.cache_write_tokens}
              totalCost={data.total_cost}
              durationMs={data.duration_ms}
            />
          </TabsContent>

          <TabsContent value="raw" className="mt-4">
            {/* Desktop: two columns */}
            <div className="hidden lg:grid lg:grid-cols-2 gap-4">
              <div className="min-h-[400px]">
                <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Request Body</h3>
                <JsonViewer data={data.request_body} />
              </div>
              <div className="min-h-[400px]">
                <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Response Body</h3>
                <JsonViewer data={data.response_body} />
              </div>
            </div>

            {/* Mobile: tabs */}
            <div className="lg:hidden">
              <Tabs defaultValue="request">
                <TabsList>
                  <TabsTrigger value="request">Request Body</TabsTrigger>
                  <TabsTrigger value="response">Response Body</TabsTrigger>
                </TabsList>
                <TabsContent value="request" className="mt-2 min-h-[400px]">
                  <JsonViewer data={data.request_body} />
                </TabsContent>
                <TabsContent value="response" className="mt-2 min-h-[400px]">
                  <JsonViewer data={data.response_body} />
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
