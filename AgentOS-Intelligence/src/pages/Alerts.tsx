import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, AlertTriangle, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import { fetchAlerts, fetchAssets, updateAlert } from '@/lib/api';
import type { Alert, Asset } from '@/types';
import { PageHeader, ErrorState, EmptyState } from '@/components/ui-primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { cn, severityClass, timeAgo } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, al] = await Promise.all([fetchAssets(), fetchAlerts()]);
      setAssets(a);
      setAlerts(al);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpdate = async (id: string, patch: Partial<Alert>) => {
    setUpdating(id);
    try {
      await updateAlert(id, patch);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
      toast.success('Alert updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setUpdating(null);
    }
  };

  const filtered = alerts.filter((a) => {
    const ms = severityFilter === 'all' || a.severity === severityFilter;
    const mst = statusFilter === 'all' || a.status === statusFilter;
    return ms && mst;
  });

  if (loading) {
    return <div className="p-6"><div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded bg-slate-100" />)}</div></div>;
  }
  if (error) {
    return <div className="p-6"><ErrorState message={error} onRetry={load} /></div>;
  }

  const openCount = alerts.filter((a) => a.status === 'Open').length;
  const ackCount = alerts.filter((a) => a.status === 'Acknowledged').length;
  const resolvedCount = alerts.filter((a) => a.status === 'Resolved').length;

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Alerts" description={`${alerts.length} alerts · ${openCount} open · ${ackCount} acknowledged · ${resolvedCount} resolved`} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="Acknowledged">Acknowledged</SelectItem>
            <SelectItem value="Resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No alerts match your filters" />
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const asset = assets.find((x) => x.id === a.asset_id);
            return (
              <div key={a.id} className={cn('rounded-lg border bg-white p-3.5 transition-colors', a.status === 'Resolved' ? 'border-slate-200 opacity-60' : 'border-slate-200')}>
                <div className="flex items-start gap-3">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
                    a.severity === 'Critical' ? 'bg-red-50' :
                    a.severity === 'High' ? 'bg-orange-50' :
                    a.severity === 'Medium' ? 'bg-amber-50' : 'bg-slate-50')}>
                    <AlertTriangle className={cn('h-4.5 w-4.5',
                      a.severity === 'Critical' ? 'text-red-500' :
                      a.severity === 'High' ? 'text-orange-500' :
                      a.severity === 'Medium' ? 'text-amber-500' : 'text-slate-400')} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-800">{a.title}</p>
                        <p className="text-[12px] text-slate-500 mt-0.5">{a.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                          <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 font-medium', severityClass(a.severity))}>{a.severity}</span>
                          <span className="capitalize">{a.type.replace(/_/g, ' ')}</span>
                          {asset && <span>· {asset.asset_tag}</span>}
                          <span>· {timeAgo(a.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge status={a.status === 'Open' ? 'At Risk' : a.status === 'Acknowledged' ? 'Monitor' : 'Healthy'} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2.5">
                      {asset && (
                        <Link to={`/assets/${asset.id}`} className="inline-flex items-center gap-0.5 text-[11px] text-blue-600 hover:underline">
                          Open Asset <ChevronRight className="h-3 w-3" />
                        </Link>
                      )}
                      {a.status === 'Open' && (
                        <button
                          onClick={() => handleUpdate(a.id, { status: 'Acknowledged' })}
                          disabled={updating === a.id}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                          {updating === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />} Acknowledge
                        </button>
                      )}
                      {a.status !== 'Resolved' && (
                        <button
                          onClick={() => handleUpdate(a.id, { status: 'Resolved', resolved_at: new Date().toISOString() })}
                          disabled={updating === a.id}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                        >
                          {updating === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Resolve
                        </button>
                      )}
                    </div>
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
