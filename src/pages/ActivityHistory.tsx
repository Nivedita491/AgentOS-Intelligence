import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  CircleDotDashed,
  FileText,
  GitBranch,
  Hash,
  Loader2,
  Search,
  ServerCrash,
} from 'lucide-react';
import { fetchActivityHistory } from '@/lib/activity';
import type { ActivityCategory, ActivityEvent, ActivityStatus } from '@/types';
import { PageHeader, EmptyState } from '@/components/ui-primitives';
import { ErrorCard } from '@/components/ErrorCard';
import { Input } from '@/components/ui/input';
import { formatDateTime, timeAgo } from '@/lib/utils';
import { toFriendlyError, type FriendlyError } from '@/shared/validation';

type DateRange = 'all' | 'today' | '7d' | '30d';

const categoryOptions: Array<{ value: ActivityCategory | ''; label: string }> = [
  { value: '', label: 'All categories' },
  { value: 'documents', label: 'Documents' },
  { value: 'rag', label: 'RAG' },
  { value: 'ai', label: 'AI' },
  { value: 'graph', label: 'Graph' },
  { value: 'memory', label: 'Memory' },
  { value: 'system', label: 'System' },
  { value: 'agents', label: 'Agents' },
];

function dateFrom(range: DateRange): string | undefined {
  if (range === 'all') return undefined;
  const date = new Date();
  if (range === 'today') date.setHours(0, 0, 0, 0);
  if (range === '7d') date.setDate(date.getDate() - 7);
  if (range === '30d') date.setDate(date.getDate() - 30);
  return date.toISOString();
}

function eventIcon(event: ActivityEvent) {
  if (event.category === 'documents') return FileText;
  if (event.category === 'graph') return GitBranch;
  if (event.category === 'memory') return BrainCircuit;
  if (event.category === 'ai') return Bot;
  if (event.status === 'failed') return ServerCrash;
  return event.status === 'running' ? CircleDotDashed : Activity;
}

function statusClass(status: ActivityStatus): string {
  return {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    failed: 'border-red-200 bg-red-50 text-red-700',
    running: 'border-blue-200 bg-blue-50 text-blue-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
  }[status];
}

export function ActivityHistory() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ActivityCategory | ''>('');
  const [status, setStatus] = useState<ActivityStatus | ''>('');
  const [range, setRange] = useState<DateRange>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  const load = useCallback(async (offset = 0, append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const page = await fetchActivityHistory({
        search: search || undefined,
        category: category || undefined,
        status: status || undefined,
        dateFrom: dateFrom(range),
        limit: 25,
        offset,
      });
      setEvents((previous) => append ? [...previous, ...page.events] : page.events);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, [category, range, search, status]);

  useEffect(() => {
    void load();
  }, [category, range, status]); // Search is submitted explicitly to avoid querying per keystroke.

  if (loading) {
    return <div className="max-w-[1200px] mx-auto p-4 lg:p-6 space-y-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-lg bg-slate-100" />)}</div>;
  }
  if (error) {
    return <div className="max-w-[1200px] mx-auto p-4 lg:p-6"><ErrorCard error={error} onRetry={() => void load()} /></div>;
  }

  return (
    <div className="max-w-[1200px] mx-auto p-4 lg:p-6">
      <PageHeader title="Activity History" description="A persistent timeline of actions across AgentOS Intelligence." />

      <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search title, request ID, document, agent…" />
          </div>
          <select value={category} onChange={(event) => setCategory(event.target.value as ActivityCategory | '')} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-[13px] text-slate-700">
            {categoryOptions.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value as ActivityStatus | '')} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-[13px] text-slate-700">
            <option value="">All statuses</option><option value="success">Success</option><option value="failed">Failed</option><option value="running">Running</option><option value="warning">Warning</option>
          </select>
          <select value={range} onChange={(event) => setRange(event.target.value as DateRange)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-[13px] text-slate-700">
            <option value="all">All time</option><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
          </select>
        </div>
      </form>

      {events.length === 0 ? <EmptyState title="No activity has been recorded yet." description="Document, RAG, graph, memory, and Copilot actions will appear here." /> : (
        <div className="space-y-2">
          {events.map((event) => {
            const Icon = eventIcon(event);
            const expanded = selectedId === event.id;
            const documentName = typeof event.metadata.documentName === 'string' ? event.metadata.documentName : null;
            return (
              <article key={event.id} className="rounded-lg border border-slate-200 bg-white transition-colors hover:border-slate-300">
                <button type="button" onClick={() => setSelectedId(expanded ? null : event.id)} aria-expanded={expanded} className="flex w-full items-start gap-3 p-3 text-left">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100"><Icon className="h-4 w-4 text-slate-600" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-semibold text-slate-700">{event.title}</p><span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass(event.status)}`}>{event.status}</span><span className="text-[10px] uppercase tracking-wide text-slate-400">{event.category}</span></div>
                    {event.description && <p className="mt-0.5 truncate text-[12px] text-slate-500">{event.description}</p>}
                    <p className="mt-1 text-[11px] text-slate-400">{documentName ?? event.activity_type.replace(/_/g, ' ')} · {timeAgo(event.created_at)}</p>
                  </div>
                  {expanded ? <ChevronUp className="mt-1 h-4 w-4 text-slate-400" /> : <ChevronDown className="mt-1 h-4 w-4 text-slate-400" />}
                </button>
                {expanded && (
                  <div className="grid gap-3 border-t border-slate-100 bg-slate-50/60 p-3 text-[12px] text-slate-600 md:grid-cols-2">
                    <dl className="space-y-2"><div><dt className="text-[10px] uppercase tracking-wide text-slate-400">Activity type</dt><dd>{event.activity_type}</dd></div><div><dt className="text-[10px] uppercase tracking-wide text-slate-400">Timestamp</dt><dd>{formatDateTime(event.created_at)}</dd></div>{event.request_id && <div><dt className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400"><Hash className="h-3 w-3" /> Request ID</dt><dd className="break-all font-mono text-[11px]">{event.request_id}</dd></div>}</dl>
                    <dl className="space-y-2">{event.document_id && <div><dt className="text-[10px] uppercase tracking-wide text-slate-400">Related document</dt><dd>{documentName ?? event.document_id}</dd></div>}{event.task_id && <div><dt className="text-[10px] uppercase tracking-wide text-slate-400">Task</dt><dd className="break-all">{event.task_id}</dd></div>}{event.duration_ms != null && <div><dt className="text-[10px] uppercase tracking-wide text-slate-400">Duration</dt><dd>{event.duration_ms.toLocaleString()} ms</dd></div>}{event.error_code && <div><dt className="text-[10px] uppercase tracking-wide text-slate-400">Error code</dt><dd>{event.error_code}</dd></div>}</dl>
                    <div className="md:col-span-2"><p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Safe metadata</p><pre className="max-h-48 overflow-auto rounded-md border border-slate-200 bg-white p-2 text-[10px] text-slate-600">{JSON.stringify(event.metadata, null, 2)}</pre></div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {hasMore && <div className="mt-4 flex justify-center"><button type="button" disabled={loadingMore} onClick={() => void load(events.length, true)} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">{loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Load more</button></div>}
    </div>
  );
}
