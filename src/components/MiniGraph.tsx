import { useMemo } from 'react';
import ReactFlow, { Background, Controls, type Node, type Edge, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import type { Entity, EntityRelationship } from '@/types';

const typeColors: Record<string, string> = {
  Asset: '#3b82f6',
  Document: '#64748b',
  Manual: '#0891b2',
  SOP: '#8b5cf6',
  Failure: '#ef4444',
  Inspection: '#f59e0b',
  'Maintenance Event': '#10b981',
  'Corrective Action': '#f97316',
  Location: '#6366f1',
};

export function MiniGraph({
  entities,
  relationships,
}: {
  entities: Entity[];
  relationships: EntityRelationship[];
}) {
  const { nodes, edges } = useMemo(() => {
    // Find the central asset node
    const assetEntity = entities.find((e) => e.entity_type === 'Asset');
    const center = { x: 250, y: 200 };

    const nodes: Node[] = entities.map((e, i) => {
      const isAsset = e.entity_type === 'Asset' && e === assetEntity;
      const angle = (i / Math.max(entities.length, 1)) * Math.PI * 2;
      const radius = isAsset ? 0 : 180;
      return {
        id: e.id,
        position: {
          x: center.x + Math.cos(angle) * radius + (isAsset ? 0 : (Math.random() - 0.5) * 40),
          y: center.y + Math.sin(angle) * radius + (isAsset ? 0 : (Math.random() - 0.5) * 40),
        },
        data: { label: e.name.length > 30 ? e.name.slice(0, 28) + '…' : e.name },
        style: {
          background: typeColors[e.entity_type] ?? '#64748b',
          color: '#fff',
          border: 'none',
          fontSize: 10,
          padding: '4px 8px',
          borderRadius: 4,
          width: 'auto',
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    const edges: Edge[] = relationships.map((r) => ({
      id: r.id,
      source: r.source_entity_id,
      target: r.target_entity_id,
      label: r.relationship_type.replace(/_/g, ' '),
      labelStyle: { fontSize: 9, fill: '#64748b' },
      style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
      labelBgStyle: { fill: '#fff' },
      labelBgPadding: [2, 2],
    }));

    return { nodes, edges };
  }, [entities, relationships]);

  return (
    <div style={{ height: 420 }} className="rounded-md border border-slate-100 bg-slate-50/30">
      <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.2 }} nodesDraggable={false} nodesConnectable={false} elementsSelectable>
        <Background color="#e2e8f0" gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
