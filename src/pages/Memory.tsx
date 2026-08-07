import { useCallback, useEffect, useState } from 'react';
import { BrainCircuit, History, RefreshCw, Database } from 'lucide-react';
import { fetchEpisodicMemory, fetchWorkingMemory } from '@/lib/api';
import type { EpisodicMemoryRecord, WorkingMemoryRecord } from '@/types';
import { PageHeader } from '@/components/ui-primitives';
import { formatDateTime } from '@/lib/utils';
import { ErrorCard } from '@/components/ErrorCard';
import { toFriendlyError, type FriendlyError } from '@/shared/validation';

export function Memory() {
  const [working, setWorking] = useState<WorkingMemoryRecord[]>([]);
  const [episodic, setEpisodic] = useState<EpisodicMemoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FriendlyError | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workingRows, episodicRows] = await Promise.all([fetchWorkingMemory(), fetchEpisodicMemory()]);
      setWorking(workingRows);
      setEpisodic(episodicRows);
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <div className="p-6"><div className="h-80 animate-pulse rounded bg-slate-100" /></div>;
  if (error) return <div className="p-6"><ErrorCard error={error} onRetry={load} /></div>;
  return (
    <div className="max-w-[1400px] mx-auto p-4 lg:p-6">
      <div className="flex items-start justify-between gap-3"><PageHeader title="Shared Memory" description="Working and episodic records from real RAG executions. Semantic and graph memory live in the indexed corpus." /><button onClick={load} className="mt-1 inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button></div>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3"><BrainCircuit className="mb-2 h-4 w-4 text-blue-600" /><p className="text-[11px] text-slate-500">Working memory</p><p className="text-lg font-semibold text-slate-700">{working.length}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-3"><History className="mb-2 h-4 w-4 text-purple-600" /><p className="text-[11px] text-slate-500">Episodic executions</p><p className="text-lg font-semibold text-slate-700">{episodic.length}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-3"><Database className="mb-2 h-4 w-4 text-emerald-600" /><p className="text-[11px] text-slate-500">Semantic memory</p><p className="text-[12px] font-medium text-slate-700">Documents, chunks, vectors</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-3"><Database className="mb-2 h-4 w-4 text-orange-500" /><p className="text-[11px] text-slate-500">Graph memory</p><p className="text-[12px] font-medium text-slate-700">Entities and evidence edges</p></div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white overflow-hidden"><div className="border-b border-slate-100 px-4 py-3"><h2 className="text-[13px] font-semibold text-slate-700">Working memory</h2></div>{working.length === 0 ? <p className="p-4 text-[12px] text-slate-400">No active or recent working-memory records.</p> : <div className="divide-y divide-slate-100">{working.map((item) => <article key={item.id} className="p-4"><div className="flex items-center justify-between gap-3"><p className="text-[13px] font-medium text-slate-700">{item.original_query}</p><span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">{item.current_status}</span></div><p className="mt-1 text-[11px] text-slate-500">{item.retrieved_chunk_ids.length} chunks · {item.discovered_entities.length} graph entities · {formatDateTime(item.updated_at)}</p>{item.current_plan.length > 0 && <p className="mt-2 text-[11px] text-slate-600">{item.current_plan.join(' → ')}</p>}</article>)}</div>}</section>
        <section className="rounded-lg border border-slate-200 bg-white overflow-hidden"><div className="border-b border-slate-100 px-4 py-3"><h2 className="text-[13px] font-semibold text-slate-700">Episodic memory</h2></div>{episodic.length === 0 ? <p className="p-4 text-[12px] text-slate-400">No completed RAG executions yet.</p> : <div className="divide-y divide-slate-100">{episodic.map((item) => <article key={item.id} className="p-4"><div className="flex items-center justify-between gap-3"><p className="text-[13px] font-medium text-slate-700">{item.query}</p><span className={item.success ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700' : 'rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600'}>{item.success ? 'evidence found' : 'no evidence'}</span></div><p className="mt-1 text-[11px] text-slate-500">{item.retrieved_evidence.length} citations · {item.latency_ms ?? '—'} ms · {formatDateTime(item.created_at)}</p><p className="mt-2 text-[11px] text-slate-600">{item.agents_used.join(' · ')}</p></article>)}</div>}</section>
      </div>
    </div>
  );
}
