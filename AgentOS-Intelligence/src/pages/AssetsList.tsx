import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { fetchAssets } from '@/lib/api';
import type { Asset } from '@/types';
import { PageHeader, ErrorState, EmptyState } from '@/components/ui-primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, cn, healthColor } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AssetsList() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sort, setSort] = useState('risk');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAssets();
      setAssets(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const types = useMemo(() => Array.from(new Set(assets.map((a) => a.type))).sort(), [assets]);

  const filtered = useMemo(() => {
    let list = assets.filter((a) => {
      const matchesSearch =
        !search ||
        a.asset_tag.toLowerCase().includes(search.toLowerCase()) ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.location.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || a.health_status === statusFilter;
      const matchesType = typeFilter === 'all' || a.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
    const riskOrder: Record<string, number> = { Critical: 0, 'At Risk': 1, Monitor: 2, Healthy: 3 };
    if (sort === 'risk') list = list.sort((a, b) => (riskOrder[a.health_status] ?? 9) - (riskOrder[b.health_status] ?? 9) || a.health_score - b.health_score);
    else if (sort === 'name') list = list.sort((a, b) => a.asset_tag.localeCompare(b.asset_tag));
    else if (sort === 'maintenance') list = list.sort((a, b) => (b.last_maintenance_date ?? '').localeCompare(a.last_maintenance_date ?? ''));
    return list;
  }, [assets, search, statusFilter, typeFilter, sort]);

  if (loading) {
    return <div className="p-6"><div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />)}</div></div>;
  }
  if (error) {
    return <div className="p-6"><ErrorState message={error} onRetry={load} /></div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Assets" description={`${assets.length} industrial assets across the facility`} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tag, name, or location…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Healthy">Healthy</SelectItem>
            <SelectItem value="Monitor">Monitor</SelectItem>
            <SelectItem value="At Risk">At Risk</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="risk">Sort: Risk</SelectItem>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="maintenance">Sort: Last Maintenance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No assets match your filters" description="Try adjusting search or filter criteria." />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50/80 sticky top-0">
                <tr className="text-left text-[11px] font-medium text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-medium">Asset Tag</th>
                  <th className="py-2.5 px-3 font-medium">Name</th>
                  <th className="py-2.5 px-3 font-medium">Type</th>
                  <th className="py-2.5 px-3 font-medium">Location</th>
                  <th className="py-2.5 px-3 font-medium">Criticality</th>
                  <th className="py-2.5 px-3 font-medium">Health</th>
                  <th className="py-2.5 px-3 font-medium">Last Maint.</th>
                  <th className="py-2.5 px-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-800">{a.asset_tag}</td>
                    <td className="py-2.5 px-3 text-slate-600">{a.name}</td>
                    <td className="py-2.5 px-3 text-slate-600">{a.type}</td>
                    <td className="py-2.5 px-3 text-slate-600">{a.location}</td>
                    <td className="py-2.5 px-3">
                      <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium',
                        a.criticality === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' :
                        a.criticality === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        a.criticality === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-50 text-slate-600 border-slate-200')}>
                        {a.criticality}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={a.health_status} />
                        <span className={cn('text-[12px] font-semibold tabular-nums', healthColor(a.health_score))}>{a.health_score}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{formatDate(a.last_maintenance_date)}</td>
                    <td className="py-2.5 px-3">
                      <Link to={`/assets/${a.id}`} className="text-blue-600 hover:underline inline-flex items-center gap-0.5 text-[12px]">
                        Open <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
