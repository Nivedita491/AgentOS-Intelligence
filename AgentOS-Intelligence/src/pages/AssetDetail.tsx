import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Factory,
  MapPin,
  Calendar,
  Wrench,
  FileText,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import {
  fetchAsset,
  fetchAssetTimeline,
  fetchAssetDocuments,
  fetchIncidents,
  fetchInspections,
  fetchAlerts,
  fetchAssetGraph,
  fetchAssetQMSRecords,
  fetchAssetDrawings,
} from '@/lib/api';
import type { Asset, TimelineEvent, Doc, Incident, Inspection, Alert, Entity, EntityRelationship, QMSRecord, EngineeringDrawing } from '@/types';
import { Card, ErrorState, LoadingRow } from '@/components/ui-primitives';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatDateTime, cn, healthColor } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MiniGraph } from '@/components/MiniGraph';

export function AssetDetail() {
  const { assetId } = useParams<{ assetId: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [insp, setInsp] = useState<Inspection[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [graph, setGraph] = useState<{ entities: Entity[]; relationships: EntityRelationship[] }>({ entities: [], relationships: [] });
  const [qmsRecords, setQmsRecords] = useState<QMSRecord[]>([]);
  const [drawings, setDrawings] = useState<EngineeringDrawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    setError(null);
    try {
      const [a, tl, d, inc, i, al, g, qms, draws] = await Promise.all([
        fetchAsset(assetId),
        fetchAssetTimeline(assetId),
        fetchAssetDocuments(assetId),
        fetchIncidents(assetId),
        fetchInspections(assetId),
        fetchAlerts(),
        fetchAssetGraph(assetId),
        fetchAssetQMSRecords(assetId),
        fetchAssetDrawings(assetId),
      ]);
      setAsset(a);
      setTimeline(tl);
      setDocs(d);
      setIncidents(inc);
      setInsp(i);
      setAlerts(al.filter((x) => x.asset_id === assetId));
      setGraph(g);
      setQmsRecords(qms);
      setDrawings(draws);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load asset');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="p-6"><div className="h-24 animate-pulse rounded bg-slate-100 mb-4" /><LoadingRow /></div>;
  }
  if (error) {
    return <div className="p-6"><ErrorState message={error} onRetry={load} /></div>;
  }
  if (!asset) {
    return <div className="p-6"><ErrorState message="Asset not found" /></div>;
  }

  const assetAlerts = alerts.filter((a) => a.status === 'Open');

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
      <Link to="/assets" className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-700 mb-3">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Assets
      </Link>

      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
                <Factory className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-800">{asset.asset_tag}</h2>
                  <StatusBadge status={asset.health_status} />
                </div>
                <p className="text-[13px] text-slate-500">{asset.name}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-slate-500">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {asset.location}</span>
              <span className="inline-flex items-center gap-1"><Factory className="h-3.5 w-3.5" /> {asset.type}</span>
              <span className="inline-flex items-center gap-1"><Wrench className="h-3.5 w-3.5" /> {asset.manufacturer ?? '—'} {asset.model ?? ''}</span>
              <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Installed {formatDate(asset.installation_date)}</span>
              <span>Criticality: <span className="font-medium text-slate-700">{asset.criticality}</span></span>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <div className={cn('text-3xl font-bold tabular-nums', healthColor(asset.health_score))}>{asset.health_score}</div>
              <div className="text-[11px] text-slate-400">Health Score</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-slate-700">{formatDate(asset.last_maintenance_date)}</div>
              <div className="text-[11px] text-slate-400">Last Maintenance</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-slate-700">{formatDate(asset.next_inspection_date)}</div>
              <div className="text-[11px] text-slate-400">Next Inspection</div>
            </div>
          </div>
        </div>

        {asset.current_observations && asset.current_observations.length > 0 && (
          <div className="mt-4 rounded-md border border-orange-200 bg-orange-50/50 p-3">
            <p className="text-[11px] font-semibold text-orange-700 mb-1.5">CURRENT OBSERVATIONS</p>
            <div className="flex flex-wrap gap-2">
              {asset.current_observations.map((o, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded border border-orange-200 bg-white px-2 py-0.5 text-[11px] text-orange-700">
                  <AlertTriangle className="h-3 w-3" /> {o}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="failures">Failure History</TabsTrigger>
          <TabsTrigger value="inspections">Inspections</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="drawings">Drawings</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="ontology">Ontology</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card title="Operational Summary">
              <dl className="space-y-2 text-[13px]">
                <div className="flex justify-between"><dt className="text-slate-500">Asset Type</dt><dd className="text-slate-700">{asset.type}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Manufacturer</dt><dd className="text-slate-700">{asset.manufacturer ?? '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Model</dt><dd className="text-slate-700">{asset.model ?? '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Criticality</dt><dd className="text-slate-700">{asset.criticality}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Installation</dt><dd className="text-slate-700">{formatDate(asset.installation_date)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Health Score</dt><dd className={cn('font-semibold', healthColor(asset.health_score))}>{asset.health_score}/100</dd></div>
              </dl>
            </Card>

            <Card title="Open Alerts">
              <div className="space-y-2">
                {assetAlerts.length === 0 && <p className="text-[12px] text-slate-400 py-2">No open alerts</p>}
                {assetAlerts.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 rounded-md border border-slate-100 bg-slate-50/50 p-2">
                    <AlertTriangle className={cn('h-4 w-4 mt-0.5 shrink-0', a.severity === 'Critical' ? 'text-red-500' : a.severity === 'High' ? 'text-orange-500' : 'text-amber-500')} />
                    <div>
                      <p className="text-[12px] font-medium text-slate-700">{a.title}</p>
                      <p className="text-[11px] text-slate-400">{a.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Compliance Status">
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between"><span className="text-slate-500">Lubrication (30d)</span><StatusBadge status="Overdue" /></div>
                <div className="flex justify-between"><span className="text-slate-500">Vibration (30d)</span><StatusBadge status="Overdue" /></div>
                <div className="flex justify-between"><span className="text-slate-500">Seal Inspection (90d)</span><StatusBadge status="Compliant" /></div>
                <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">Internal prototype compliance rules</p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <Card title="Recent Observations">
              <ul className="space-y-1.5 text-[13px]">
                {(asset.current_observations ?? []).map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-600">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" /> {o}
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Related Documents">
              <div className="space-y-1.5">
                {docs.slice(0, 5).map((d) => (
                  <Link key={d.id} to={`/documents/${d.id}`} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50/50 p-2 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="text-[12px] font-medium text-slate-700 truncate">{d.filename}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline">
          <Card title="Asset Timeline">
            <div className="relative pl-6">
              <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-200" />
              {timeline.map((e) => (
                <div key={e.id} className="relative pb-4">
                  <div className={cn('absolute -left-[18px] top-1 h-3 w-3 rounded-full border-2 border-white',
                    e.type === 'incident' ? 'bg-red-500' :
                    e.type === 'maintenance' ? 'bg-blue-500' :
                    e.type === 'inspection' ? 'bg-amber-500' :
                    e.type === 'document' ? 'bg-slate-400' : 'bg-emerald-500')} />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-medium text-slate-700">{e.title}</p>
                      {e.description && <p className="text-[12px] text-slate-500">{e.description}</p>}
                      {e.source && <p className="text-[11px] text-slate-400 mt-0.5">{e.source}</p>}
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">{formatDate(e.date)}</span>
                  </div>
                </div>
              ))}
              {timeline.length === 0 && <p className="text-[12px] text-slate-400 py-4">No timeline events</p>}
            </div>
          </Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card title="Linked Documents">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-slate-100 text-left text-[11px] text-slate-500">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Uploaded</th>
                  <th className="py-2 pr-3 font-medium"></th>
                </tr></thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-2.5 pr-3 font-medium text-slate-700">{d.filename}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{d.document_type}</td>
                      <td className="py-2.5 pr-3"><StatusBadge status={d.status} /></td>
                      <td className="py-2.5 pr-3 text-slate-500">{formatDateTime(d.uploaded_at)}</td>
                      <td className="py-2.5 pr-3"><Link to={`/documents/${d.id}`} className="text-blue-600 hover:underline text-[12px]">Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {docs.length === 0 && <p className="text-[12px] text-slate-400 py-4 text-center">No documents linked</p>}
            </div>
          </Card>
        </TabsContent>

        {/* Failure History */}
        <TabsContent value="failures">
          <Card title="Failure History">
            {incidents.length === 0 ? (
              <p className="text-[12px] text-slate-400 py-4 text-center">No failure events recorded for this asset</p>
            ) : (
              <div className="space-y-3">
                {incidents.map((n) => (
                  <div key={n.id} className="rounded-md border border-red-200 bg-red-50/30 p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[13px] font-semibold text-slate-800">{n.title}</p>
                        <p className="text-[11px] text-slate-500">{formatDate(n.incident_date)} · Severity: {n.severity} · Downtime: {n.downtime_hours}h</p>
                      </div>
                      <StatusBadge status={n.severity === 'High' ? 'Critical' : 'At Risk'} />
                    </div>
                    {n.symptoms && <p className="mt-2 text-[12px] text-slate-600"><span className="font-medium">Symptoms:</span> {n.symptoms}</p>}
                    {n.root_cause && <p className="mt-1 text-[12px] text-slate-600"><span className="font-medium">Root cause:</span> {n.root_cause}</p>}
                    {n.corrective_action && <p className="mt-1 text-[12px] text-slate-600"><span className="font-medium">Corrective action:</span> {n.corrective_action}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Inspections */}
        <TabsContent value="inspections">
          <Card title="Inspection Records">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-slate-100 text-left text-[11px] text-slate-500">
                  <th className="py-2 pr-3 font-medium">Inspection</th>
                  <th className="py-2 pr-3 font-medium">Completed</th>
                  <th className="py-2 pr-3 font-medium">Due Date</th>
                  <th className="py-2 pr-3 font-medium">Result</th>
                  <th className="py-2 pr-3 font-medium">Findings</th>
                </tr></thead>
                <tbody>
                  {insp.map((i) => (
                    <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-2.5 pr-3 font-medium text-slate-700">{i.inspection_type}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{formatDate(i.completed_date)}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{formatDate(i.due_date)}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{i.result ?? '—'}</td>
                      <td className="py-2.5 pr-3 text-slate-500 max-w-xs">{i.findings ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {insp.length === 0 && <p className="text-[12px] text-slate-400 py-4 text-center">No inspection records</p>}
            </div>
          </Card>
        </TabsContent>

        {/* Relationships */}
        <TabsContent value="relationships">
          <Card title="Asset Relationship Graph">
            <p className="text-[12px] text-slate-500 mb-3">Knowledge graph focused on {asset.asset_tag}</p>
            {graph.entities.length > 0 ? (
              <MiniGraph entities={graph.entities} relationships={graph.relationships} />
            ) : (
              <p className="text-[12px] text-slate-400 py-4 text-center">No relationships found</p>
            )}
          </Card>
        </TabsContent>

        {/* Quality (QMS) */}
        <TabsContent value="quality">
          <Card title="Quality Records">
            {qmsRecords.length === 0 ? (
              <p className="text-[12px] text-slate-400 py-4 text-center">No QMS records for this asset</p>
            ) : (
              <div className="space-y-2">
                {qmsRecords.map((r) => (
                  <div key={r.id} className="rounded-md border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-mono font-medium text-slate-500">{r.code}</span>
                        <span className="ml-2 text-[10px] rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-600">{r.record_type}</span>
                      </div>
                      <StatusBadge status={r.status === 'Open' ? 'At Risk' : 'Compliant'} />
                    </div>
                    <p className="text-[13px] font-medium text-slate-700 mt-1">{r.title}</p>
                    {r.description && <p className="text-[12px] text-slate-500 mt-0.5">{r.description}</p>}
                    {r.corrective_action && <p className="text-[11px] text-slate-500 mt-1"><span className="font-medium">Corrective:</span> {r.corrective_action}</p>}
                    {r.preventive_action && <p className="text-[11px] text-slate-500 mt-0.5"><span className="font-medium">Preventive:</span> {r.preventive_action}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Drawings */}
        <TabsContent value="drawings">
          <Card title="Engineering Drawings">
            {drawings.length === 0 ? (
              <p className="text-[12px] text-slate-400 py-4 text-center">No engineering drawings linked</p>
            ) : (
              <div className="space-y-2">
                {drawings.map((d) => (
                  <div key={d.id} className="rounded-md border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-slate-700">{d.filename}</span>
                        <span className="text-[10px] rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-600">{d.drawing_type}</span>
                      </div>
                      <StatusBadge status={d.status === 'Processed' ? 'Compliant' : 'At Risk'} />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                      <span>{d.detected_tags?.length ?? 0} equipment tags</span>
                      <span>{d.detected_instruments?.length ?? 0} instruments</span>
                      <span>Vision: {String(d.metadata_json?.vision_agent ?? 'ocr')}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {d.detected_tags?.map((t, i) => (
                        <span key={i} className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-mono text-blue-700">{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Components */}
        <TabsContent value="components">
          <Card title="Related Components">
            <p className="text-[11px] text-slate-400 mb-2">Ontology-extracted components for this asset</p>
            {graph.entities.filter((e) => e.entity_type === 'Component').length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {graph.entities.filter((e) => e.entity_type === 'Component').map((c) => (
                  <div key={c.id} className="rounded-md border border-slate-100 bg-slate-50/50 p-2.5">
                    <p className="text-[12px] font-medium text-slate-700">{c.name}</p>
                    <p className="text-[10px] text-slate-400">{String(c.metadata_json?.component_type ?? 'Component')}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-slate-400 py-4 text-center">No components extracted for this asset</p>
            )}
          </Card>
        </TabsContent>

        {/* Ontology */}
        <TabsContent value="ontology">
          <Card title="Ontology Relationships">
            <p className="text-[11px] text-slate-400 mb-3">Industrial ontology entities and typed relationships</p>
            <div className="space-y-2">
              {graph.relationships.slice(0, 15).map((r) => {
                const source = graph.entities.find((e) => e.id === r.source_entity_id);
                const target = graph.entities.find((e) => e.id === r.target_entity_id);
                return (
                  <div key={r.id} className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2 text-[12px]">
                    <span className="font-medium text-slate-700 truncate flex-1 min-w-0">{source?.name ?? '—'}</span>
                    <span className="text-[10px] rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-blue-700 font-mono shrink-0">{r.relationship_type.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-slate-700 truncate flex-1 min-w-0 text-right">{target?.name ?? '—'}</span>
                  </div>
                );
              })}
              {graph.relationships.length === 0 && <p className="text-[12px] text-slate-400 py-4 text-center">No ontology relationships found</p>}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
