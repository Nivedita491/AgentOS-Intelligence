import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Factory,
  FileText,
  AlertTriangle,
  ShieldAlert,
  Bot,
  Clock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { fetchAssets, fetchDocuments, fetchAlerts, fetchAIQueries, fetchComplianceFindings } from '@/lib/api';
import type { Asset, Doc, Alert, AIQuery, ComplianceFinding } from '@/types';
import { MetricCard, PageHeader, Card, LoadingCard, ErrorState } from '@/components/ui-primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, timeAgo, cn, healthColor } from '@/lib/utils';

export function Dashboard() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [queries, setQueries] = useState<AIQuery[]>([]);
  const [findings, setFindings] = useState<ComplianceFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, d, al, q, f] = await Promise.all([
        fetchAssets(),
        fetchDocuments(),
        fetchAlerts(),
        fetchAIQueries(6),
        fetchComplianceFindings(),
      ]);
      setAssets(a);
      setDocs(d);
      setAlerts(al);
      setQueries(q);
      setFindings(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <LoadingCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  const healthCounts = {
    Healthy: assets.filter((a) => a.health_status === 'Healthy').length,
    Monitor: assets.filter((a) => a.health_status === 'Monitor').length,
    'At Risk': assets.filter((a) => a.health_status === 'At Risk').length,
    Critical: assets.filter((a) => a.health_status === 'Critical').length,
  };

  const docTypeCounts = docs.reduce<Record<string, number>>((acc, d) => {
    acc[d.document_type] = (acc[d.document_type] ?? 0) + 1;
    return acc;
  }, {});
  const docTypeData = Object.entries(docTypeCounts).map(([name, value]) => ({ name, value }));

  const riskTrend = [
    { month: 'Feb', risks: 1 },
    { month: 'Mar', risks: 2 },
    { month: 'Apr', risks: 2 },
    { month: 'May', risks: 3 },
    { month: 'Jun', risks: 3 },
    { month: 'Jul', risks: 4 },
  ];

  const complianceGaps = findings.filter((f) => f.status === 'Overdue' || f.status === 'Missing Evidence').length;
  const activeRisks = assets.filter((a) => a.health_status === 'At Risk' || a.health_status === 'Critical').length;
  const openAlerts = alerts.filter((a) => a.status === 'Open');

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Command Center"
        description="Real-time operational intelligence across AstraForge Process Industries"
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MetricCard label="Total Assets" value={assets.length} icon={Factory} tone="info" />
        <MetricCard label="Indexed Documents" value={docs.length} icon={FileText} tone="default" />
        <MetricCard label="Active Risks" value={activeRisks} icon={AlertTriangle} tone="danger" />
        <MetricCard label="Compliance Gaps" value={complianceGaps} icon={ShieldAlert} tone="warning" />
        <MetricCard label="AI Queries Answered" value={126} icon={Bot} tone="success" sub="demo" />
        <MetricCard label="Search Time Saved" value="42h" icon={Clock} tone="success" sub="est." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Asset Health Overview */}
        <Card title="Asset Health Overview">
          <div className="space-y-3">
            {(['Healthy', 'Monitor', 'At Risk', 'Critical'] as const).map((s) => (
              <div key={s} className="flex items-center justify-between">
                <StatusBadge status={s} />
                <div className="flex items-center gap-2 flex-1 ml-3">
                  <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        s === 'Healthy' && 'bg-emerald-500',
                        s === 'Monitor' && 'bg-amber-500',
                        s === 'At Risk' && 'bg-orange-500',
                        s === 'Critical' && 'bg-red-500',
                      )}
                      style={{ width: `${(healthCounts[s] / assets.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 tabular-nums w-6 text-right">
                    {healthCounts[s]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Risk Trend */}
        <Card title="Active Risk Trend" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={riskTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                }}
              />
              <Bar dataKey="risks" fill="#f97316" radius={[3, 3, 0, 0]} name="Active Risks" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Priority Alerts */}
        <Card title="Priority Alerts" action={<Link to="/alerts" className="text-[11px] text-blue-600 hover:underline">View all</Link>}>
          <div className="space-y-2.5">
            {openAlerts.slice(0, 4).map((a) => {
              const asset = assets.find((x) => x.id === a.asset_id);
              return (
                <div
                  key={a.id}
                  className="flex items-start gap-2.5 rounded-md border border-slate-100 bg-slate-50/50 p-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => asset && navigate(`/assets/${asset.id}`)}
                >
                  <AlertTriangle className={cn('h-4 w-4 mt-0.5 shrink-0', a.severity === 'Critical' ? 'text-red-500' : a.severity === 'High' ? 'text-orange-500' : 'text-amber-500')} />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-slate-700 truncate">{a.title}</p>
                    <p className="text-[11px] text-slate-400 truncate">{asset?.asset_tag ?? 'System'} · {timeAgo(a.created_at)}</p>
                  </div>
                </div>
              );
            })}
            {openAlerts.length === 0 && <p className="text-[12px] text-slate-400 py-4 text-center">No open alerts</p>}
          </div>
        </Card>

        {/* Recent Intelligence */}
        <Card title="Recent Intelligence">
          <div className="space-y-2.5">
            {queries.slice(0, 4).map((q) => (
              <div key={q.id} className="flex items-start gap-2.5 rounded-md border border-slate-100 bg-slate-50/50 p-2.5">
                <Bot className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-slate-700 truncate">{q.query}</p>
                  <p className="text-[11px] text-slate-400">{q.intent ?? 'query'} · {timeAgo(q.created_at)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-start gap-2.5 rounded-md border border-slate-100 bg-slate-50/50 p-2.5">
              <FileText className="h-4 w-4 mt-0.5 shrink-0 text-slate-500" />
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-slate-700">New document indexed</p>
                <p className="text-[11px] text-slate-400">Shift Handover Log Unit 2 · 1d ago</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-md border border-slate-100 bg-slate-50/50 p-2.5">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-slate-700">Compliance gap detected</p>
                <p className="text-[11px] text-slate-400">B-07 safety inspection overdue · 1d ago</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Document Intelligence Overview */}
        <Card title="Document Intelligence">
          <div className="space-y-3">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={docTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {docTypeData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
              <span>{docs.length} documents</span>
              <span>{docs.filter((d) => d.status === 'Indexed').length} indexed</span>
              <span>51 entities</span>
            </div>
          </div>
        </Card>
      </div>

      {/* High-Risk Assets Table */}
      <Card title="High-Risk Assets" className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-medium text-slate-500">
                <th className="py-2 pr-3 font-medium">Asset</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Location</th>
                <th className="py-2 pr-3 font-medium">Health</th>
                <th className="py-2 pr-3 font-medium">Score</th>
                <th className="py-2 pr-3 font-medium">Open Alerts</th>
                <th className="py-2 pr-3 font-medium">Last Maint.</th>
                <th className="py-2 pr-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {assets
                .filter((a) => a.health_status === 'At Risk' || a.health_status === 'Critical')
                .sort((a, b) => a.health_score - b.health_score)
                .map((a) => {
                  const assetAlerts = alerts.filter((x) => x.asset_id === a.id && x.status === 'Open').length;
                  return (
                    <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-slate-800">{a.asset_tag}</div>
                        <div className="text-[11px] text-slate-400">{a.name}</div>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">{a.type}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{a.location}</td>
                      <td className="py-2.5 pr-3"><StatusBadge status={a.health_status} /></td>
                      <td className={cn('py-2.5 pr-3 font-semibold tabular-nums', healthColor(a.health_score))}>{a.health_score}</td>
                      <td className="py-2.5 pr-3 text-slate-600 tabular-nums">{assetAlerts}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{formatDate(a.last_maintenance_date)}</td>
                      <td className="py-2.5 pr-3">
                        <Link to={`/assets/${a.id}`} className="text-blue-600 hover:underline text-[12px] inline-flex items-center gap-0.5">
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent AI Queries */}
      <Card title="Recent AI Queries">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-medium text-slate-500">
                <th className="py-2 pr-3 font-medium">Question</th>
                <th className="py-2 pr-3 font-medium">Asset</th>
                <th className="py-2 pr-3 font-medium">Confidence</th>
                <th className="py-2 pr-3 font-medium">Time</th>
                <th className="py-2 pr-3 font-medium">Sources</th>
              </tr>
            </thead>
            <tbody>
              {queries.map((q) => {
                const asset = assets.find((x) => x.id === q.asset_id);
                return (
                  <tr key={q.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => navigate('/copilot')}>
                    <td className="py-2.5 pr-3 text-slate-700 max-w-xs truncate">{q.query}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{asset?.asset_tag ?? '—'}</td>
                    <td className="py-2.5 pr-3">
                      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                        q.confidence === 'high' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : q.confidence === 'medium' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-slate-600 bg-slate-50 border-slate-200')}>
                        {q.confidence ?? '—'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500">{timeAgo(q.created_at)}</td>
                    <td className="py-2.5 pr-3 text-slate-600 tabular-nums">{q.sources_json?.length ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Prototype Impact */}
      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <h3 className="text-[13px] font-semibold text-blue-800">Prototype Scenario Outcome — Demonstration Estimate</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <p className="text-[11px] text-slate-500">Traditional search</p>
            <p className="text-lg font-semibold text-slate-700">35–45 min</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">ForgeMind retrieval</p>
            <p className="text-lg font-semibold text-emerald-600">~8 sec</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">Sources connected</p>
            <p className="text-lg font-semibold text-slate-700">5 docs</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">Evidence links</p>
            <p className="text-lg font-semibold text-slate-700">11</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">Compliance gaps</p>
            <p className="text-lg font-semibold text-slate-700">1</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500">Downtime avoided</p>
            <p className="text-lg font-semibold text-slate-700">1 scenario</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          These figures are prototype demonstration estimates, not independently verified real-world results.
        </p>
      </div>
    </div>
  );
}
