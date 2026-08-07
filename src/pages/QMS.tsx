import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Search } from 'lucide-react';
import { fetchQMSRecords, fetchAssets, updateQMSRecord } from '@/lib/api';
import type { QMSRecord, Asset } from '@/types';
import { PageHeader, Card, ErrorState, EmptyState } from '@/components/ui-primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const TYPE_LABELS: Record<string, string> = {
  Deviation: 'Deviations',
  CAPA: 'CAPA',
  NCR: 'Non-Conformances',
  AuditFinding: 'Audit Findings',
  CorrectiveAction: 'Corrective Actions',
  PreventiveAction: 'Preventive Actions',
  TrainingRecord: 'Training Records',
  QualityEvent: 'Quality Events',
  BatchInvestigation: 'Batch Investigations',
};

export function QMS() {
  const [records, setRecords] = useState<QMSRecord[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tab, setTab] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, a] = await Promise.all([fetchQMSRecords(), fetchAssets()]);
      setRecords(r);
      setAssets(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load QMS records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateQMSRecord(id, { status, closed_date: status === 'Closed' ? new Date().toISOString() : null });
      setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      toast.success('QMS record updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const filtered = records.filter((r) => {
    const ms = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase());
    const mst = statusFilter === 'all' || r.status === statusFilter;
    const mt = tab === 'all' || r.record_type === tab;
    return ms && mst && mt;
  });

  const counts: Record<string, number> = { all: records.length };
  records.forEach((r) => { counts[r.record_type] = (counts[r.record_type] ?? 0) + 1; });

  if (loading) {
    return <div className="p-6"><div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded bg-slate-100" />)}</div></div>;
  }
  if (error) {
    return <div className="p-6"><ErrorState message={error} onRetry={load} /></div>;
  }

  const openCount = records.filter((r) => r.status === 'Open').length;
  const highCount = records.filter((r) => r.severity === 'High' || r.severity === 'Critical').length;

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Quality Management System" description={`${records.length} QMS records · ${openCount} open · ${highCount} high severity`}>
        <span className="text-[11px] text-slate-400">Internal QMS — not external regulations</span>
      </PageHeader>

      {/* Overview metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <Card><p className="text-[11px] text-slate-500">Deviations</p><p className="text-2xl font-semibold text-orange-600 tabular-nums">{counts['Deviation'] ?? 0}</p></Card>
        <Card><p className="text-[11px] text-slate-500">CAPA</p><p className="text-2xl font-semibold text-blue-600 tabular-nums">{counts['CAPA'] ?? 0}</p></Card>
        <Card><p className="text-[11px] text-slate-500">NCR</p><p className="text-2xl font-semibold text-red-600 tabular-nums">{counts['NCR'] ?? 0}</p></Card>
        <Card><p className="text-[11px] text-slate-500">Audit Findings</p><p className="text-2xl font-semibold text-amber-600 tabular-nums">{counts['AuditFinding'] ?? 0}</p></Card>
        <Card><p className="text-[11px] text-slate-500">Corrective/Preventive</p><p className="text-2xl font-semibold text-emerald-600 tabular-nums">{(counts['CorrectiveAction'] ?? 0) + (counts['PreventiveAction'] ?? 0)}</p></Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All ({counts['all'] ?? 0})</TabsTrigger>
          <TabsTrigger value="Deviation">Deviations ({counts['Deviation'] ?? 0})</TabsTrigger>
          <TabsTrigger value="CAPA">CAPA ({counts['CAPA'] ?? 0})</TabsTrigger>
          <TabsTrigger value="NCR">NCR ({counts['NCR'] ?? 0})</TabsTrigger>
          <TabsTrigger value="AuditFinding">Audits ({counts['AuditFinding'] ?? 0})</TabsTrigger>
          <TabsTrigger value="CorrectiveAction">Corrective ({counts['CorrectiveAction'] ?? 0})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by code or title…" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Records list */}
      {filtered.length === 0 ? (
        <EmptyState title="No QMS records match your filters" />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const asset = assets.find((a) => a.id === r.asset_id);
            return (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
                      r.severity === 'Critical' ? 'bg-red-50' :
                      r.severity === 'High' ? 'bg-orange-50' :
                      r.severity === 'Medium' ? 'bg-amber-50' : 'bg-slate-50')}>
                      <AlertTriangle className={cn('h-4.5 w-4.5',
                        r.severity === 'Critical' ? 'text-red-500' :
                        r.severity === 'High' ? 'text-orange-500' :
                        r.severity === 'Medium' ? 'text-amber-500' : 'text-slate-400')} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-medium text-slate-500">{r.code}</span>
                        <span className="text-[10px] rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-600">{TYPE_LABELS[r.record_type] ?? r.record_type}</span>
                      </div>
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{r.title}</p>
                      {r.description && <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-2">{r.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 font-medium',
                          r.severity === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' :
                          r.severity === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          'bg-amber-50 text-amber-700 border-amber-200')}>
                          {r.severity}
                        </span>
                        {asset && <span>· <Link to={`/assets/${asset.id}`} className="text-blue-600 hover:underline">{asset.asset_tag}</Link></span>}
                        <span>· {r.owner ?? '—'}</span>
                        <span>· Due {formatDate(r.due_date)}</span>
                      </div>
                      {r.corrective_action && (
                        <p className="text-[11px] text-slate-500 mt-1"><span className="font-medium">Corrective:</span> {r.corrective_action}</p>
                      )}
                      {r.preventive_action && (
                        <p className="text-[11px] text-slate-500 mt-0.5"><span className="font-medium">Preventive:</span> {r.preventive_action}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <StatusBadge status={r.status === 'Open' ? 'At Risk' : r.status === 'Closed' ? 'Compliant' : 'Monitor'} />
                    {r.status === 'Open' && (
                      <button
                        onClick={() => handleStatusChange(r.id, 'Closed')}
                        className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        Close
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
