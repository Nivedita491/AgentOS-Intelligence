import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, AlertTriangle, ChevronRight, Loader2, Activity, Lightbulb } from 'lucide-react';
import {
  fetchAssets,
  fetchAllMaintenanceEvents,
  fetchAllIncidents,
  fetchRecommendedActions,
  copilotQuery,
} from '@/lib/api';
import type { Asset, MaintenanceEvent, Incident, RecommendedAction } from '@/types';
import type { AnswerPayload } from '@/types';
import { PageHeader, Card, ErrorState, EmptyState } from '@/components/ui-primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, cn, confidenceColor } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const SYMPTOMS = [
  'Bearing temperature elevated',
  'Vibration increased',
  'Lubrication task overdue',
  'Seal leakage',
  'Efficiency below baseline',
  'Unusual noise',
];

export function Maintenance() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [actions, setActions] = useState<RecommendedAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rcaAsset, setRcaAsset] = useState<string>('P-204');
  const [rcaSymptom, setRcaSymptom] = useState<string>('Bearing temperature elevated');
  const [rcaContext, setRcaContext] = useState('');
  const [rcaResult, setRcaResult] = useState<AnswerPayload | null>(null);
  const [rcaLoading, setRcaLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, e, i, ac] = await Promise.all([
        fetchAssets(),
        fetchAllMaintenanceEvents(),
        fetchAllIncidents(),
        fetchRecommendedActions(),
      ]);
      setAssets(a);
      setEvents(e);
      setIncidents(i);
      setActions(ac);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load maintenance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runRCA = async () => {
    setRcaLoading(true);
    setRcaResult(null);
    try {
      const query = `Why is ${rcaAsset} experiencing ${rcaSymptom.toLowerCase()}?${rcaContext ? ` Operating context: ${rcaContext}` : ''}`;
      const { answer } = await copilotQuery(query);
      setRcaResult(answer);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'RCA failed');
    } finally {
      setRcaLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6"><div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />)}</div></div>;
  }
  if (error) {
    return <div className="p-6"><ErrorState message={error} onRetry={load} /></div>;
  }

  const riskQueue = assets
    .filter((a) => a.health_status === 'At Risk' || a.health_status === 'Critical')
    .sort((a, b) => a.health_score - b.health_score);

  const repeatedPatterns = incidents;

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Maintenance Intelligence" description="Root cause analysis, risk queue, and recommended actions" />

      {/* RCA Workspace */}
      <Card title="Root Cause Analysis Workspace" className="mb-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-3">
            <div>
              <label className="text-[11px] font-medium text-slate-500 mb-1 block">Asset</label>
              <Select value={rcaAsset} onValueChange={setRcaAsset}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {assets.map((a) => <SelectItem key={a.id} value={a.asset_tag}>{a.asset_tag} — {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 mb-1 block">Observed Symptom</label>
              <Select value={rcaSymptom} onValueChange={setRcaSymptom}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SYMPTOMS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 mb-1 block">Operating Context (optional)</label>
              <Textarea value={rcaContext} onChange={(e) => setRcaContext(e.target.value)} placeholder="e.g. high-load operation, recent alignment deferred…" rows={3} />
            </div>
            <Button onClick={runRCA} disabled={rcaLoading} className="w-full">
              {rcaLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Analysing…</> : <><Activity className="h-4 w-4 mr-1.5" /> Generate Analysis</>}
            </Button>
          </div>

          <div className="lg:col-span-2">
            {rcaLoading ? (
              <div className="flex items-center justify-center h-full py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="ml-2 text-[13px] text-slate-500">Generating root cause analysis…</span>
              </div>
            ) : rcaResult ? (
              <div className="space-y-3">
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-500 uppercase mb-1">Direct Answer</h4>
                  <p className="text-[13px] text-slate-700">{rcaResult.directAnswer}</p>
                </div>
                {rcaResult.probableCauses.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5">Probable Causes</h4>
                    <div className="space-y-1.5">
                      {rcaResult.probableCauses.map((c, i) => (
                        <div key={i} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50/50 px-3 py-1.5">
                          <span className="text-[13px] text-slate-700">{i + 1}. {c.cause}</span>
                          <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize', confidenceColor(c.confidence))}>
                            {c.confidence}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {rcaResult.recommendedActions.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1"><Lightbulb className="h-3.5 w-3.5" /> Recommended Actions</h4>
                    <ul className="space-y-1">
                      {rcaResult.recommendedActions.map((a, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-slate-600">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" /> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {rcaResult.riskNote && (
                  <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50/50 p-2.5">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500 shrink-0" />
                    <p className="text-[12px] text-slate-600">{rcaResult.riskNote}</p>
                  </div>
                )}
                <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                  Confidence labels represent AI evidence confidence, not predictive-model accuracy.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <Activity className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-[13px] text-slate-500">Select an asset and symptom, then generate a root cause analysis.</p>
                <p className="text-[11px] text-slate-400 mt-1">Default: P-204 with bearing temperature elevated.</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Risk Queue */}
        <Card title="Maintenance Risk Queue">
          <div className="space-y-2">
            {riskQueue.map((a) => (
              <Link key={a.id} to={`/assets/${a.id}`} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50/50 p-2.5 hover:bg-slate-50 transition-colors">
                <div>
                  <p className="text-[13px] font-medium text-slate-700">{a.asset_tag} — {a.name}</p>
                  <p className="text-[11px] text-slate-400">{a.type} · {a.location} · Score {a.health_score}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={a.health_status} />
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ))}
            {riskQueue.length === 0 && <p className="text-[12px] text-slate-400 py-4 text-center">No assets at risk</p>}
          </div>
        </Card>

        {/* Upcoming Maintenance */}
        <Card title="Upcoming Maintenance">
          <div className="space-y-2">
            {events.slice(0, 6).map((e) => {
              const asset = assets.find((a) => a.id === e.asset_id);
              return (
                <div key={e.id} className="flex items-start gap-2.5 rounded-md border border-slate-100 bg-slate-50/50 p-2.5">
                  <Wrench className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-slate-700">{asset?.asset_tag ?? '—'} — {e.event_type}</p>
                    <p className="text-[11px] text-slate-500">{e.description}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(e.event_date)} · {e.technician ?? '—'}</p>
                  </div>
                </div>
              );
            })}
            {events.length === 0 && <p className="text-[12px] text-slate-400 py-4 text-center">No upcoming maintenance</p>}
          </div>
        </Card>
      </div>

      {/* Repeated Failure Patterns */}
      <Card title="Repeated Failure Patterns" className="mb-4">
        {repeatedPatterns.length === 0 ? (
          <EmptyState title="No repeated failure patterns detected" />
        ) : (
          <div className="space-y-2">
            {repeatedPatterns.map((n) => {
              const asset = assets.find((a) => a.id === n.asset_id);
              return (
                <div key={n.id} className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50/30 p-3">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-700">{n.title}</p>
                    <p className="text-[11px] text-slate-500">{asset?.asset_tag ?? '—'} · {formatDate(n.incident_date)} · {n.downtime_hours}h downtime</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Root cause: {n.root_cause}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Recommended Actions */}
      <Card title="Recommended Actions">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-slate-100 text-left text-[11px] text-slate-500">
              <th className="py-2 pr-3 font-medium">Asset</th>
              <th className="py-2 pr-3 font-medium">Action</th>
              <th className="py-2 pr-3 font-medium">Priority</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Due</th>
            </tr></thead>
            <tbody>
              {actions.map((a) => {
                const asset = assets.find((x) => x.id === a.asset_id);
                return (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-2.5 pr-3 font-medium text-slate-700">{asset?.asset_tag ?? '—'}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{a.title}</td>
                    <td className="py-2.5 pr-3">
                      <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium',
                        a.priority === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' :
                        a.priority === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        a.priority === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-50 text-slate-600 border-slate-200')}>
                        {a.priority}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3"><StatusBadge status={a.status === 'Open' ? 'At Risk' : 'Healthy'} /></td>
                    <td className="py-2.5 pr-3 text-slate-500">{formatDate(a.due_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {actions.length === 0 && <p className="text-[12px] text-slate-400 py-4 text-center">No recommended actions</p>}
        </div>
      </Card>
    </div>
  );
}
