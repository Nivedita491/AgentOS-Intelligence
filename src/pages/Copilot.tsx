import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Bot,
  Send,
  Copy,
  FileText,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  ChevronRight,
  Loader2,
  Wrench,
  Trash2,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { copilotQuery, saveAIQuery, fetchAIQueries, fetchAssets, createRecommendedAction } from '@/lib/api';
import type { AnswerPayload, CitationSource, Asset, AIQuery } from '@/types';
import { cn, confidenceColor } from '@/lib/utils';
import { toast } from 'sonner';
import { ErrorCard } from '@/components/ErrorCard';
import { toFriendlyError, type FriendlyError } from '@/shared/validation';

const SUGGESTED = [
  'Why is Pump P-204 repeatedly overheating?',
  'Can P-204 safely continue operating until the next scheduled shutdown?',
  'Which inspections are overdue this month?',
  'Show previous failures similar to P-204.',
  'What does the OEM manual recommend for bearing overheating?',
  'What evidence is missing for Boiler B-07 compliance?',
  'Summarise the last three maintenance events for Compressor C-101.',
];

interface Message {
  id: string;
  query: string;
  answer: AnswerPayload | null;
  sources: CitationSource[];
  loading: boolean;
  error?: FriendlyError;
  fallback?: boolean;
}

export function Copilot() {
  const [params] = useSearchParams();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<AIQuery[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [thinking, setThinking] = useState(false);
  const [stage, setStage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [h, a] = await Promise.all([fetchAIQueries(15), fetchAssets()]);
      setHistory(h);
      setAssets(a);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = params.get('q');
    if (q) {
      setInput(q);
      runQuery(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const runQuery = useCallback(
    async (query: string) => {
      if (!query.trim()) return;
      const msgId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: msgId, query, answer: null, sources: [], loading: true }]);
      setInput('');
      setThinking(true);
      setStage('Classifying query…');

      const stages = ['Retrieving documents…', 'Extracting evidence…', 'Generating grounded answer…'];
      let si = 0;
      const stageTimer = setInterval(() => {
        setStage(stages[si] ?? stages[stages.length - 1]);
        si = Math.min(si + 1, stages.length - 1);
      }, 800);

      try {
        const { answer, sources, fallback } = await copilotQuery(query);
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, answer, sources, loading: false, fallback } : m)),
        );
        await saveAIQuery({
          query,
          intent: answer.intent,
          asset_id: assets.find((a) => answer.assetTag && a.asset_tag === answer.assetTag)?.id ?? null,
          answer,
          confidence: answer.confidence.level,
          sources_json: sources,
        });
        load();
      } catch (e) {
        const friendly = toFriendlyError(e);
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, loading: false, error: friendly } : m)));
        toast.error(friendly.message);
      } finally {
        clearInterval(stageTimer);
        setThinking(false);
        setStage('');
      }
    },
    [assets, load],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runQuery(input);
  };

  const clearConversation = () => {
    setMessages([]);
  };

  const copyAnswer = (m: Message) => {
    if (!m.answer) return;
    const text = `${m.answer.directAnswer}\n\nProbable Causes:\n${m.answer.probableCauses.map((c) => `- ${c.cause} (${c.confidence})`).join('\n')}\n\nRecommended Actions:\n${m.answer.recommendedActions.map((a) => `- ${a}`).join('\n')}\n\nSources:\n${m.sources.map((s) => `- ${s.documentName} (${s.section})`).join('\n')}\n\nConfidence: ${m.answer.confidence.level} (${m.answer.confidence.score}%)`;
    navigator.clipboard.writeText(text);
    toast.success('Answer copied to clipboard');
  };

  const exportAnswer = (m: Message) => {
    if (!m.answer) return;
    const text = JSON.stringify(m.answer, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forgemind-analysis-${m.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Analysis exported');
  };

  const createAction = async (m: Message) => {
    if (!m.answer) return;
    const asset = assets.find((a) => m.answer?.assetTag && a.asset_tag === m.answer.assetTag);
    if (!asset) {
      toast.error('No linked asset for this action');
      return;
    }
    await createRecommendedAction({
      asset_id: asset.id,
      title: `Action from AI Copilot: ${m.query.slice(0, 60)}`,
      description: m.answer.recommendedActions.join('\n'),
      priority: 'High',
      status: 'Open',
      due_date: null,
      source_query_id: null,
    });
    toast.success('Maintenance action created');
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left panel */}
      <div className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-[13px] font-semibold text-slate-700">Recent & Saved</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {history.map((q) => (
            <button
              key={q.id}
              onClick={() => runQuery(q.query)}
              className="block w-full text-left rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2 hover:bg-slate-50 transition-colors"
            >
              <p className="text-[12px] font-medium text-slate-700 line-clamp-2">{q.query}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{q.intent ?? 'query'} · {q.confidence ?? '—'}</p>
            </button>
          ))}
          {history.length === 0 && <p className="text-[12px] text-slate-400 px-2 py-4">No recent queries</p>}
        </div>
        <div className="border-t border-slate-100 px-4 py-3">
          <h4 className="text-[11px] font-semibold text-slate-500 mb-2">SUGGESTED QUERIES</h4>
          <div className="space-y-1">
            {SUGGESTED.slice(0, 4).map((s) => (
              <button
                key={s}
                onClick={() => runQuery(s)}
                className="block w-full text-left rounded-md px-2 py-1.5 text-[11px] text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-blue-600" />
            <span className="text-[13px] font-semibold text-slate-700">AI Copilot Workspace</span>
          </div>
          {messages.length > 0 && (
            <button onClick={clearConversation} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700">
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 lg:p-6">
          {messages.length === 0 && !thinking && (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 mb-4">
                <Bot className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">Industrial Intelligence Copilot</h2>
              <p className="text-[13px] text-slate-500 mb-6">Ask operational questions grounded in your indexed documents. Every answer includes source citations and confidence.</p>
              <div className="grid sm:grid-cols-2 gap-2 w-full">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    onClick={() => runQuery(s)}
                    className="text-left rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[12px] text-slate-700 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto space-y-4">
            {messages.map((m) => (
              <div key={m.id} className="animate-fade-in">
                {/* Question */}
                <div className="flex justify-end mb-2">
                  <div className="rounded-lg rounded-br-sm bg-blue-600 px-3.5 py-2 text-[13px] text-white max-w-xl">
                    {m.query}
                  </div>
                </div>

                {/* Answer */}
                {m.loading ? (
                  <div className="flex items-center gap-2 text-[13px] text-slate-500 py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span>{stage || 'Processing…'}</span>
                  </div>
                ) : m.error ? (
                  <ErrorCard error={m.error} onRetry={() => runQuery(m.query)} />
                ) : m.answer ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
                    {m.fallback && (
                      <div className="flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-700">
                        <Info className="h-3.5 w-3.5" /> Evidence-only mode: Gemini generation was unavailable, so no unsupported synthesis was produced.
                      </div>
                    )}

                    {/* Agent Orchestration Trace */}
                    {m.answer.agentTrace && m.answer.agentTrace.length > 0 && (
                      <div className="rounded-md border border-slate-200 bg-slate-50/50 p-3">
                        <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Bot className="h-3.5 w-3.5" /> Multi-Agent Orchestration Trace
                        </h4>
                        <div className="space-y-1.5">
                          {m.answer.agentTrace.map((step, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-[11px]">
                              <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-medium shrink-0',
                                step.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                step.status === 'skipped' ? 'bg-slate-100 text-slate-400' : 'bg-red-100 text-red-700')}>
                                {idx + 1}
                              </span>
                              <span className="font-medium text-slate-700 shrink-0">{step.agent}</span>
                              <span className="text-slate-500 truncate">{step.action}</span>
                              {step.evidenceCount > 0 && <span className="text-slate-400 shrink-0">({step.evidenceCount})</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Hybrid Retrieval Info */}
                    {m.answer.retrieval && (
                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-500">
                        <span className="font-medium">Hybrid Retrieval:</span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700">
                          Vector: {m.answer.retrieval.vector.count}
                        </span>
                        {m.answer.retrieval.lexical && <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-cyan-700">Lexical: {m.answer.retrieval.lexical.count}</span>}
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                          Metadata: {m.answer.retrieval.metadata.count}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-purple-700">
                          Knowledge Graph: {m.answer.retrieval.knowledgeGraph.count}
                        </span>
                      </div>
                    )}

                    {/* Direct Answer */}
                    <div>
                      <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Direct Answer</h4>
                      <p className="text-[13px] text-slate-700 leading-relaxed">{m.answer.directAnswer}</p>
                    </div>

                    {/* Key Findings */}
                    {m.answer.keyFindings.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Key Findings</h4>
                        <ul className="space-y-1.5">
                          {m.answer.keyFindings.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-[13px] text-slate-600">
                              <CheckCircle2 className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                              <span>{f.finding}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Probable Causes */}
                    {m.answer.probableCauses.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Probable Causes</h4>
                        <div className="space-y-1.5">
                          {m.answer.probableCauses.map((c, i) => (
                            <div key={i} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50/50 px-3 py-1.5">
                              <span className="text-[13px] text-slate-700">{i + 1}. {c.cause}</span>
                              <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize', confidenceColor(c.confidence))}>
                                {c.confidence} confidence
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommended Actions */}
                    {m.answer.recommendedActions.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1"><Lightbulb className="h-3.5 w-3.5" /> Recommended Actions</h4>
                        <ul className="space-y-1">
                          {m.answer.recommendedActions.map((a, i) => (
                            <li key={i} className="flex items-start gap-2 text-[13px] text-slate-600">
                              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" /> {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Risk Note */}
                    {m.answer.riskNote && (
                      <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50/50 p-3">
                        <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500 shrink-0" />
                        <div>
                          <p className="text-[11px] font-semibold text-orange-700 uppercase">Risk / Safety Note</p>
                          <p className="text-[12px] text-slate-600 mt-0.5">{m.answer.riskNote}</p>
                        </div>
                      </div>
                    )}

                    {/* Sources */}
                    {m.sources.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Sources ({m.sources.length})</h4>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {m.sources.map((s, i) => (
                            <Link
                              key={i}
                              to={`/documents/${s.documentId}`}
                              className="block rounded-md border border-slate-200 bg-slate-50/50 p-2.5 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="text-[12px] font-medium text-slate-700 truncate">{s.documentName}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">{s.section}{s.page ? ` · Page ${s.page}` : ''}</p>
                              {s.excerpt && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{s.excerpt}</p>}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* QMS Findings */}
                    {m.answer.qmsFindings && m.answer.qmsFindings.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1"><ShieldAlert className="h-3.5 w-3.5" /> QMS Records Referenced</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {m.answer.qmsFindings.map((q, i) => (
                            <span key={i} className={cn('inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px]',
                              q.relevance === 'direct' ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-slate-200 bg-slate-50 text-slate-600')}>
                              <span className="font-mono font-medium">{q.code}</span>
                              <span className="text-slate-400">·</span>
                              <span>{q.recordType}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Confidence + Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">Confidence:</span>
                        <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize', confidenceColor(m.answer.confidence.level))}>
                          {m.answer.confidence.level} · {m.answer.confidence.score}%
                        </span>
                        <span className="text-[10px] text-slate-400">{m.answer.confidence.basis}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => copyAnswer(m)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 transition-colors">
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                        <button onClick={() => exportAnswer(m)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 transition-colors">
                          <FileText className="h-3 w-3" /> Export
                        </button>
                        {m.answer.assetTag && (
                          <>
                            <Link to={`/assets/${assets.find((a) => a.asset_tag === m.answer?.assetTag)?.id ?? ''}`} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 transition-colors">
                              <ChevronRight className="h-3 w-3" /> Open Asset
                            </Link>
                            <button onClick={() => createAction(m)} className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-100 transition-colors">
                              <Wrench className="h-3 w-3" /> Create Action
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}

            {thinking && !messages.some((m) => m.loading) && (
              <div className="flex items-center gap-2 text-[13px] text-slate-500 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span>{stage || 'Processing…'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 bg-white p-4">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask an operational question…"
              className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-3.5 w-3.5" /> Ask
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
