import { useState } from 'react';
import { Search, Database, Network, Filter, Sparkles } from 'lucide-react';
import { ragSearch } from '@/lib/api';
import type { RetrievalCandidateDebug, RetrievalDebug } from '@/types';
import { PageHeader } from '@/components/ui-primitives';
import { Input } from '@/components/ui/input';

const EXAMPLES = [
  'What are the currently approved AgentOS features?',
  'What price was approved in the latest pricing document?',
  'Who approved the launch campaign?',
];

function score(value: number | undefined): string {
  return typeof value === 'number' ? value.toFixed(3) : '—';
}

function ResultTable({ title, rows, mode }: { title: string; rows: RetrievalCandidateDebug[]; mode: 'vector' | 'lexical' | 'metadata' | 'graph' | 'fusion' | 'rerank' }) {
  const value = (row: RetrievalCandidateDebug) => {
    if (mode === 'vector') return score(row.semanticScore);
    if (mode === 'lexical') return score(row.lexicalScore);
    if (mode === 'metadata') return score(row.metadataScore);
    if (mode === 'graph') return score(row.graphScore);
    if (mode === 'fusion') return score(row.fusedScore);
    return score(row.rerankScore);
  };
  return (
    <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <h3 className="text-[12px] font-semibold text-slate-700">{title}</h3>
        <span className="text-[11px] text-slate-400">{rows.length} chunks</span>
      </div>
      {rows.length === 0 ? <p className="p-3 text-[12px] text-slate-400">No candidates.</p> : (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr><th className="px-3 py-2 font-medium">Evidence</th><th className="px-3 py-2 font-medium">Scores</th><th className="px-3 py-2 font-medium">{mode === 'rerank' ? 'Rerank' : 'Primary'}</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.chunkId} className="border-t border-slate-100 align-top">
                  <td className="max-w-xl px-3 py-2">
                    <p className="font-medium text-slate-700">{row.documentName}</p>
                    <p className="text-slate-400">{row.sectionTitle ?? 'Document'}{row.pageNumber ? ` · Page ${row.pageNumber}` : ''}</p>
                    <p className="mt-1 line-clamp-2 text-slate-500">{row.content}</p>
                    {row.traversal?.length ? <p className="mt-1 text-purple-600">Graph path: {row.traversal.join(' → ')}</p> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 leading-5 text-slate-500">
                    <div>V {score(row.semanticScore)} · L {score(row.lexicalScore)}</div>
                    <div>G {score(row.graphScore)} · M {score(row.metadataScore)}</div>
                    <div>RRF {score(row.fusedScore)}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-700">{value(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function RagSearch() {
  const [query, setQuery] = useState(EXAMPLES[0]);
  const [department, setDepartment] = useState('');
  const [tags, setTags] = useState('');
  const [result, setResult] = useState<RetrievalDebug | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await ragSearch(query, {
        department: department || undefined,
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'RAG search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 lg:p-6">
      <PageHeader title="RAG Search" description="Inspect real vector, full-text, metadata, and graph retrieval before answer generation." />
      <form onSubmit={runSearch} className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-2 lg:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask the organizational knowledge base…" /></div>
          <Input className="lg:w-48" value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Department filter" />
          <Input className="lg:w-48" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Tags, comma-separated" />
          <button disabled={loading} className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" /> {loading ? 'Retrieving…' : 'Run retrieval'}</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => <button type="button" key={example} onClick={() => setQuery(example)} className="rounded-full border border-slate-200 px-2 py-1 text-[10px] text-slate-500 hover:border-blue-300 hover:text-blue-700">{example}</button>)}
        </div>
      </form>
      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">{error}</div>}
      {result && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3"><Database className="mb-2 h-4 w-4 text-blue-600" /><p className="text-[11px] text-slate-500">Query embedding</p><p className="mt-0.5 text-[13px] font-medium text-slate-700">{result.embeddingCreated ? result.embeddingModel : 'Not created'}</p></div>
            <div className="rounded-lg border border-slate-200 bg-white p-3"><Filter className="mb-2 h-4 w-4 text-emerald-600" /><p className="text-[11px] text-slate-500">Rewritten queries</p><p className="mt-0.5 text-[13px] font-medium text-slate-700">{result.rewrittenQueries.length}</p></div>
            <div className="rounded-lg border border-slate-200 bg-white p-3"><Network className="mb-2 h-4 w-4 text-purple-600" /><p className="text-[11px] text-slate-500">Graph candidates</p><p className="mt-0.5 text-[13px] font-medium text-slate-700">{result.graphResults.length}</p></div>
            <div className="rounded-lg border border-slate-200 bg-white p-3"><Sparkles className="mb-2 h-4 w-4 text-orange-500" /><p className="text-[11px] text-slate-500">Final evidence</p><p className="mt-0.5 text-[13px] font-medium text-slate-700">{result.finalResults.length}</p></div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-600">
            <p><span className="font-medium">Query:</span> {result.query}</p>
            <p className="mt-1"><span className="font-medium">Retrieval queries:</span> {result.rewrittenQueries.join(' · ')}</p>
            {result.warnings.length > 0 && <p className="mt-1 text-amber-700"><span className="font-medium">Warnings:</span> {result.warnings.join(' ')}</p>}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <ResultTable title="Vector results (cosine similarity)" rows={result.vectorResults} mode="vector" />
            <ResultTable title="Lexical results (PostgreSQL FTS)" rows={result.lexicalResults} mode="lexical" />
            <ResultTable title="Metadata candidates" rows={result.metadataResults} mode="metadata" />
            <ResultTable title="Graph results (1–2 hops)" rows={result.graphResults} mode="graph" />
          </div>
          <ResultTable title="Weighted reciprocal-rank fusion" rows={result.fusionResults} mode="fusion" />
          <ResultTable title="Final reranked evidence context" rows={result.finalResults} mode="rerank" />
        </div>
      )}
    </div>
  );
}
