import { useEffect, useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  Position,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Search, X, Expand } from 'lucide-react';
import { fetchEntityEvidence, fetchGraphData } from '@/lib/api';
import type { Entity, EntityRelationship } from '@/types';
import { PageHeader } from '@/components/ui-primitives';
import { ErrorCard } from '@/components/ErrorCard';
import { toFriendlyError, type FriendlyError } from '@/shared/validation';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const typeColors: Record<string, string> = {
  Asset: '#3b82f6',
  Document: '#64748b',
  Manual: '#0891b2',
  SOP: '#8b5cf6',
  Drawing: '#0d9488',
  Failure: '#ef4444',
  Symptom: '#f43f5e',
  Inspection: '#f59e0b',
  'Maintenance Event': '#10b981',
  'Corrective Action': '#f97316',
  QMSRecord: '#a855f7',
  Location: '#6366f1',
  Technician: '#14b8a6',
  Department: '#8b5cf6',
  ComplianceRequirement: '#dc2626',
  Risk: '#e11d48',
  Organization: '#2563eb',
  Product: '#0891b2',
  Employee: '#14b8a6',
  Client: '#a855f7',
  Technology: '#0f766e',
  Meeting: '#f59e0b',
  Policy: '#dc2626',
  Campaign: '#ec4899',
  Project: '#6366f1',
  Team: '#7c3aed',
  Decision: '#f97316',
  Person: '#06b6d4',
};

export function KnowledgeGraph() {
  const [data, setData] = useState<{ entities: Entity[]; relationships: EntityRelationship[] }>({ entities: [], relationships: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());
  const [relationshipFilters, setRelationshipFilters] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Entity | null>(null);
  const [focusTag, setFocusTag] = useState('P-204');
  const [expandedEntityIds, setExpandedEntityIds] = useState<Set<string>>(new Set());
  const [selectedEvidence, setSelectedEvidence] = useState<Array<{ chunkId: string; documentId: string; documentName: string; content: string; pageNumber: number | null; sectionTitle: string | null }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchGraphData();
      setData(d);
      setTypeFilters(new Set(d.entities.map((entity) => entity.entity_type)));
      setRelationshipFilters(new Set(d.relationships.map((relationship) => relationship.relationship_type)));
    } catch (e) {
      setError(toFriendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { nodes, edges } = useMemo(() => {
    const { entities, relationships } = data;

    // If focus tag is set, filter to entities connected to that asset
    let relevantEntities = entities;
    let relevantRels = relationships;

    if (focusTag) {
      const focusEntity = entities.find((e) => e.entity_type === 'Asset' && e.normalized_name === focusTag.toLowerCase());
      if (focusEntity) {
        const connectedIds = new Set<string>([focusEntity.id]);
        relationships.forEach((r) => {
          if (r.source_entity_id === focusEntity.id) connectedIds.add(r.target_entity_id);
          if (r.target_entity_id === focusEntity.id) connectedIds.add(r.source_entity_id);
        });
        for (const expandedId of expandedEntityIds) {
          relationships.forEach((r) => {
            if (r.source_entity_id === expandedId) connectedIds.add(r.target_entity_id);
            if (r.target_entity_id === expandedId) connectedIds.add(r.source_entity_id);
          });
        }
        relevantRels = relationships.filter((r) => connectedIds.has(r.source_entity_id) && connectedIds.has(r.target_entity_id));
        relevantEntities = entities.filter((e) => connectedIds.has(e.id));
      }
    }

    // Apply type filter
    relevantEntities = relevantEntities.filter((e) => typeFilters.has(e.entity_type));
    const visibleIds = new Set(relevantEntities.map((e) => e.id));
    relevantRels = relevantRels.filter((r) => visibleIds.has(r.source_entity_id) && visibleIds.has(r.target_entity_id) && relationshipFilters.has(r.relationship_type));

    // Apply search
    if (search) {
      relevantEntities = relevantEntities.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));
    }

    // Layout: radial around the focus asset
    const focusEntity = relevantEntities.find((e) => e.entity_type === 'Asset' && e.normalized_name === focusTag.toLowerCase());
    const center = { x: 400, y: 250 };
    const others = relevantEntities.filter((e) => e !== focusEntity);

    const nodes: Node[] = relevantEntities.map((e, i) => {
      const isFocus = e === focusEntity;
      const angle = (i / Math.max(others.length, 1)) * Math.PI * 2;
      const radius = isFocus ? 0 : 220;
      return {
        id: e.id,
        position: {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        },
        data: { label: e.name.length > 28 ? e.name.slice(0, 26) + '…' : e.name },
        style: {
          background: typeColors[e.entity_type] ?? '#64748b',
          color: '#fff',
          border: isFocus ? '3px solid #f97316' : 'none',
          fontSize: 10,
          fontWeight: isFocus ? 600 : 400,
          padding: '6px 10px',
          borderRadius: 6,
          width: 'auto',
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    const edges: Edge[] = relevantRels.map((r) => ({
      id: r.id,
      source: r.source_entity_id,
      target: r.target_entity_id,
      label: r.relationship_type.replace(/_/g, ' '),
      labelStyle: { fontSize: 9, fill: '#475569' },
      style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
      labelBgStyle: { fill: '#fff' },
      labelBgPadding: [3, 3] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
    }));

    return { nodes, edges };
  }, [data, focusTag, typeFilters, relationshipFilters, search, expandedEntityIds]);

  const toggleType = (type: string) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleRelationship = (type: string) => {
    setRelationshipFilters((previous) => {
      const next = new Set(previous);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const selectEntity = async (entity: Entity | null) => {
    setSelected(entity);
    setSelectedEvidence([]);
    if (!entity) return;
    try {
      setSelectedEvidence(await fetchEntityEvidence(entity.id));
    } catch {
      setSelectedEvidence([]);
    }
  };

  const entityTypes = Array.from(new Set(data.entities.map((entity) => entity.entity_type))).sort();
  const relationshipTypes = Array.from(new Set(data.relationships.map((relationship) => relationship.relationship_type))).sort();

  if (loading) {
    return <div className="p-6"><div className="h-96 animate-pulse rounded bg-slate-100" /></div>;
  }
  if (error) {
    return <div className="p-6"><ErrorCard error={error} onRetry={load} /></div>;
  }

  const selectedRels = selected
    ? data.relationships.filter((r) => r.source_entity_id === selected.id || r.target_entity_id === selected.id)
    : [];

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Knowledge Graph" description="Visualise relationships between assets, documents, failures, and actions" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <label className="text-[11px] font-medium text-slate-500 mb-1.5 block">Focus Asset</label>
            <select
              value={focusTag}
              onChange={(e) => setFocusTag(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All entities</option>
              {data.entities.filter((e) => e.entity_type === 'Asset').map((e) => (
                <option key={e.id} value={e.metadata_json?.tag as string ?? e.normalized_name}>{e.name}</option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <label className="text-[11px] font-medium text-slate-500 mb-1.5 block">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search entities…" className="pl-8 h-8 text-[12px]" />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <label className="text-[11px] font-medium text-slate-500 mb-1.5 block">Entity Types</label>
            <div className="space-y-1">
              {entityTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={cn(
                    'flex items-center gap-2 w-full rounded-md px-2 py-1 text-[12px] transition-colors',
                    typeFilters.has(t) ? 'bg-slate-50 text-slate-700' : 'text-slate-400',
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: typeColors[t] }} />
                  <span className="flex-1 text-left">{t}</span>
                  {!typeFilters.has(t) && <X className="h-3 w-3" />}
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-medium text-slate-500 mb-2">Relationship Types</p>
            <div className="space-y-0.5 text-[10px] text-slate-500">
              {relationshipTypes.map((r) => (
                <button key={r} onClick={() => toggleRelationship(r)} className={cn('flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left', relationshipFilters.has(r) ? 'text-slate-600' : 'text-slate-300')}>
                  <span className="h-px w-4 bg-slate-300" />
                  <span>{r.replace(/_/g, ' ')}</span>
                  {!relationshipFilters.has(r) && <X className="ml-auto h-3 w-3" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Graph */}
        <div className="lg:col-span-3">
          <div style={{ height: 560 }} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              onNodeClick={(_, node) => void selectEntity(data.entities.find((e) => e.id === node.id) ?? null)}
              nodesConnectable={false}
            >
              <Background color="#e2e8f0" gap={20} />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={(n) => typeColors[(n.data as { entityType?: string })?.entityType ?? ''] ?? '#64748b'}
                maskColor="rgba(0,0,0,0.05)"
                style={{ borderRadius: 4 }}
              />
            </ReactFlow>
          </div>
        </div>
      </div>

      {/* Selected node drawer */}
      {selected && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 animate-fade-in">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background: typeColors[selected.entity_type] }} />
                <h3 className="text-[14px] font-semibold text-slate-800">{selected.name}</h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Type: {selected.entity_type}</p>
            </div>
            <button onClick={() => void selectEntity(null)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
          </div>

          {selected.metadata_json && Object.keys(selected.metadata_json).length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-medium text-slate-500 mb-1">Metadata</p>
              <div className="rounded-md bg-slate-50 p-2 text-[11px] text-slate-600 font-mono">
                {Object.entries(selected.metadata_json).slice(0, 5).map(([k, v]) => (
                  <div key={k}><span className="text-slate-400">{k}:</span> {String(v).slice(0, 40)}</div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] font-medium text-slate-500 mb-1.5">Relationships ({selectedRels.length})</p>
            <div className="space-y-1">
              {selectedRels.slice(0, 8).map((r) => {
                const other = r.source_entity_id === selected.id
                  ? data.entities.find((e) => e.id === r.target_entity_id)
                  : data.entities.find((e) => e.id === r.source_entity_id);
                const direction = r.source_entity_id === selected.id ? '→' : '←';
                return (
                  <div key={r.id} className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50/50 px-2 py-1 text-[12px]">
                    <span className="text-slate-400">{direction}</span>
                    <span className="font-medium text-blue-600">{r.relationship_type.replace(/_/g, ' ')}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-slate-700 truncate">{other?.name ?? '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <button onClick={() => setExpandedEntityIds((previous) => new Set([...previous, selected.id]))} className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] text-purple-700 hover:bg-purple-100">
              <Expand className="h-3 w-3" /> Expand connected neighbors
            </button>
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-1.5 text-[11px] font-medium text-slate-500">Connected evidence ({selectedEvidence.length})</p>
            <div className="space-y-1.5">
              {selectedEvidence.slice(0, 5).map((evidence) => (
                <a key={evidence.chunkId} href={`/documents/${evidence.documentId}`} className="block rounded-md border border-slate-100 bg-slate-50/60 px-2 py-1.5 text-[11px] hover:border-blue-200 hover:bg-blue-50/40">
                  <span className="font-medium text-slate-700">{evidence.documentName}</span>
                  <span className="ml-1 text-slate-400">{evidence.sectionTitle ?? 'Document'}{evidence.pageNumber ? ` · Page ${evidence.pageNumber}` : ''}</span>
                  <p className="mt-0.5 line-clamp-2 text-slate-500">{evidence.content}</p>
                </a>
              ))}
              {selectedEvidence.length === 0 && <p className="text-[11px] text-slate-400">No chunk-level evidence recorded for this entity.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
