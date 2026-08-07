import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, FileText, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import { fetchComplianceRules, fetchComplianceFindings, fetchAssets, fetchDocuments } from '@/lib/api';
import type { ComplianceRule, ComplianceFinding, Asset, Doc } from '@/types';
import { PageHeader, Card, ErrorState, EmptyState } from '@/components/ui-primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export function Compliance() {
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [findings, setFindings] = useState<ComplianceFinding[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, f, a, d] = await Promise.all([
        fetchComplianceRules(),
        fetchComplianceFindings(),
        fetchAssets(),
        fetchDocuments(),
      ]);
      setRules(r);
      setFindings(f);
      setAssets(a);
      setDocs(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      // Recompute client-side (deterministic, same logic as DB)
      await load();
      toast.success('Compliance findings refreshed');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <div className="p-6"><div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />)}</div></div>;
  }
  if (error) {
    return <div className="p-6"><ErrorState message={error} onRetry={load} /></div>;
  }

  const counts = {
    Compliant: findings.filter((f) => f.status === 'Compliant').length,
    'Due Soon': findings.filter((f) => f.status === 'Due Soon').length,
    Overdue: findings.filter((f) => f.status === 'Overdue').length,
    'Missing Evidence': findings.filter((f) => f.status === 'Missing Evidence').length,
  };

  const filtered = findings.filter((f) => statusFilter === 'all' || f.status === statusFilter);

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Compliance Intelligence" description="Deterministic rule-based compliance engine — internal prototype rules">
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          Refresh
        </Button>
      </PageHeader>

      {/* Overview metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card><div className="flex items-center justify-between"><div><p className="text-[11px] text-slate-500">Compliant</p><p className="text-2xl font-semibold text-emerald-600 tabular-nums">{counts.Compliant}</p></div><ShieldCheck className="h-5 w-5 text-emerald-500" /></div></Card>
        <Card><div className="flex items-center justify-between"><div><p className="text-[11px] text-slate-500">Due Soon</p><p className="text-2xl font-semibold text-amber-600 tabular-nums">{counts['Due Soon']}</p></div><ShieldAlert className="h-5 w-5 text-amber-500" /></div></Card>
        <Card><div className="flex items-center justify-between"><div><p className="text-[11px] text-slate-500">Overdue</p><p className="text-2xl font-semibold text-red-600 tabular-nums">{counts.Overdue}</p></div><ShieldAlert className="h-5 w-5 text-red-500" /></div></Card>
        <Card><div className="flex items-center justify-between"><div><p className="text-[11px] text-slate-500">Missing Evidence</p><p className="text-2xl font-semibold text-slate-600 tabular-nums">{counts['Missing Evidence']}</p></div><FileText className="h-5 w-5 text-slate-400" /></div></Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter by status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Compliant">Compliant</SelectItem>
            <SelectItem value="Due Soon">Due Soon</SelectItem>
            <SelectItem value="Overdue">Overdue</SelectItem>
            <SelectItem value="Missing Evidence">Missing Evidence</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Findings table */}
      {filtered.length === 0 ? (
        <EmptyState title="No compliance findings" description="Compliance findings will appear here once computed." />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50/80">
                <tr className="text-left text-[11px] font-medium text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-medium">Rule</th>
                  <th className="py-2.5 px-3 font-medium">Asset</th>
                  <th className="py-2.5 px-3 font-medium">Interval</th>
                  <th className="py-2.5 px-3 font-medium">Last Evidence</th>
                  <th className="py-2.5 px-3 font-medium">Due Date</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => {
                  const rule = rules.find((r) => r.id === f.compliance_rule_id);
                  const asset = assets.find((a) => a.id === f.asset_id);
                  const evidenceDoc = docs.find((d) => d.id === f.evidence_document_id);
                  return (
                    <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-slate-700">{rule?.name ?? '—'}</p>
                        <p className="text-[10px] text-slate-400">{rule?.code}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        {asset ? (
                          <Link to={`/assets/${asset.id}`} className="font-medium text-blue-600 hover:underline">{asset.asset_tag}</Link>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 tabular-nums">{rule?.interval_days}d</td>
                      <td className="py-2.5 px-3 text-slate-500">{formatDate(f.last_evidence_date)}</td>
                      <td className="py-2.5 px-3 text-slate-500">{formatDate(f.due_date)}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={f.status} />
                          {f.days_overdue > 0 && <span className="text-[10px] text-red-500">({f.days_overdue}d)</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {evidenceDoc ? (
                          <Link to={`/documents/${evidenceDoc.id}`} className="text-blue-600 hover:underline text-[12px] inline-flex items-center gap-0.5">
                            Evidence <ChevronRight className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-[11px] text-slate-400">No evidence</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rules reference */}
      <Card title="Configured Compliance Rules" className="mt-4">
        <div className="space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="rounded-md border border-slate-100 bg-slate-50/50 p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-slate-700">{r.code} — {r.name}</p>
                  <p className="text-[11px] text-slate-500">{r.description ?? '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">Interval: {r.interval_days}d</span>
                  <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium',
                    r.severity === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' :
                    r.severity === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                    'bg-slate-50 text-slate-600 border-slate-200')}>
                    {r.severity}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">{r.configured_source}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/30 p-3">
        <p className="text-[11px] text-slate-500">
          These are internal prototype compliance rules. They do not represent external regulations or legal compliance requirements.
          Date calculations are deterministic and computed client-side from stored evidence dates.
        </p>
      </div>
    </div>
  );
}
