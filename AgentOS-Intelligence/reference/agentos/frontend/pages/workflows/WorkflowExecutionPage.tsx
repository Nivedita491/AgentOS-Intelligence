import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  BrainCircuit,
  FileText,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getMission, injectRequirement, startMission } from "../../services/missionApi";
import type { MissionRecord, WorkflowNode as WorkflowNodeType } from "../../types";
import { Button, ProgressBar, StatusChip } from "../../components/ui";
import { formatTime } from "../../lib/utils";
import { workflowNodeTypes } from "./WorkflowNode";

const COLUMN_GAP = 220;
const ROW_GAP = 120;

function layoutNodes(nodes: WorkflowNodeType[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const depthMap = new Map<string, number>();

  function computeDepth(id: string): number {
    if (depthMap.has(id)) return depthMap.get(id)!;
    const node = nodesById.get(id);
    if (!node || node.dependencies.length === 0) {
      depthMap.set(id, 0);
      return 0;
    }
    const depth = 1 + Math.max(...node.dependencies.map(computeDepth));
    depthMap.set(id, depth);
    return depth;
  }

  nodes.forEach((n) => computeDepth(n.id));

  const byDepth = new Map<number, WorkflowNodeType[]>();
  nodes.forEach((n) => {
    const d = depthMap.get(n.id) ?? 0;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(n);
  });

  byDepth.forEach((levelNodes, depth) => {
    const count = levelNodes.length;
    const startX = (count - 1) * COLUMN_GAP * 0.5;
    levelNodes.forEach((n, index) => {
      positions[n.id] = {
        x: startX - index * COLUMN_GAP,
        y: depth * ROW_GAP,
      };
    });
  });

  return positions;
}

export function WorkflowExecutionPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const [mission, setMission] = useState<MissionRecord | null>(null);
  const [draftRequirement, setDraftRequirement] = useState("Also analyze cybersecurity and provide a recovery path.");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workflowId) {
      return;
    }

    let ignore = false;
    const id = workflowId;

    async function loadMission() {
      const data = await getMission(id);
      if (!ignore) {
        setMission(data);
      }
    }

    void loadMission();
    const timer = window.setInterval(() => {
      void loadMission();
    }, 1400);

    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [workflowId]);

  const positions = useMemo(() => {
    if (!mission) return {};
    return layoutNodes(mission.workflow.nodes);
  }, [mission]);

  const nodes: Node[] = useMemo(() => {
    if (!mission) return [];
    return mission.workflow.nodes.map((node) => {
      const pos = positions[node.id] ?? { x: 0, y: 0 };
      return {
        id: node.id,
        type: "agent",
        position: pos,
        data: { node },
      };
    });
  }, [mission, positions]);

  const edges: Edge[] = useMemo(() => {
    if (!mission) return [];
    return mission.workflow.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: isActiveEdge(mission, edge.source, edge.target),
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#8b5cf6" },
      style: { stroke: "#3a3f4d", strokeWidth: 1.5 },
    }));
  }, [mission]);

  const [rfNodes, setRfNodes] = useState<Node[]>(nodes);
  const [rfEdges, setRfEdges] = useState<Edge[]>(edges);

  useEffect(() => {
    setRfNodes(nodes);
  }, [nodes]);

  useEffect(() => {
    setRfEdges(edges);
  }, [edges]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

  async function handleStart() {
    if (!workflowId) return;
    const data = await startMission(workflowId);
    setMission(data);
  }

  async function handleInject() {
    if (!workflowId || !draftRequirement.trim()) return;
    setLoading(true);
    try {
      const data = await injectRequirement(workflowId, draftRequirement);
      setMission(data);
      setDraftRequirement("");
    } finally {
      setLoading(false);
    }
  }

  if (!mission) {
    return (
      <div className="activity-empty">
        <Bot size={24} />
        <strong>Select a mission</strong>
        <p>Launch a mission to view its live workflow.</p>
      </div>
    );
  }

  return (
    <div className="mission-page workflow-full">
      <div className="workflow-heading">
        <div>
          <span className="section-label">LIVE WORKFLOW</span>
          <h1>{mission.objective}</h1>
          <p>Mission {mission.missionId} • {mission.status}</p>
        </div>

        <div className="workflow-heading-actions">
          <span className="live-badge"><Activity size={12} /> LIVE DAG</span>
          {mission.report ? (
            <Link to={`/app/reports/${mission.missionId}`}>
              <Button variant="success" size="sm">
                <FileText size={14} />
                View Report
              </Button>
            </Link>
          ) : mission.status === "running" ? (
            <Button variant="secondary" size="sm" disabled>
              <Activity size={14} />
              Running…
            </Button>
          ) : (
            <Button size="sm" onClick={handleStart}>
              <Sparkles size={14} />
              Start mission
            </Button>
          )}
        </div>
      </div>

      <ProgressBar value={mission.progress} className="workflow-progress" />

      <div className="workflow-stats">
        <WorkflowStat icon={<Activity size={14} />} label="PROGRESS" value={`${mission.progress}%`} />
        <WorkflowStat icon={<BrainCircuit size={14} />} label="RECOVERY" value={mission.metrics.recoveryCount} />
        <WorkflowStat icon={<ShieldCheck size={14} />} label="FAILURES" value={mission.metrics.failures} />
        <WorkflowStat icon={<Bot size={14} />} label="COST" value={`$${mission.metrics.cost.toFixed(1)}`} />
        <WorkflowStat icon={<RefreshCcw size={14} />} label="TOKENS" value={mission.metrics.tokens} />
      </div>

      <div className="workflow-layout">
        <section className="workflow-canvas workflow-rf">
          <div className="canvas-header">
            <div>
              <span className="canvas-mode">ADAPTIVE EXECUTION GRAPH</span>
              <h2>Node state and dependency flow</h2>
            </div>
          </div>

          <div className="rf-wrap">
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={workflowNodeTypes as never}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.4}
              maxZoom={1.6}
              nodesDraggable
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#1a1f2b" />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={(n) =>
                  (n.data as { node?: WorkflowNodeType })?.node?.status === "running"
                    ? "#8b5cf6"
                    : (n.data as { node?: WorkflowNodeType })?.node?.status === "completed"
                      ? "#32d583"
                      : (n.data as { node?: WorkflowNodeType })?.node?.status === "failed"
                        ? "#f87171"
                        : "#3a3f4d"
                }
                maskColor="rgba(6,7,11,0.6)"
                className="wf-minimap"
              />
            </ReactFlow>
          </div>
        </section>

        <aside className="activity-panel">
          <div className="activity-header">
            <div>
              <span className="canvas-mode">OBSERVABILITY</span>
              <h2>Live events</h2>
            </div>
            <div className="activity-pulse" />
          </div>

          <div className="mission-injection">
            <div className="injection-heading">
              <div>
                <h3>Dynamic requirement injection</h3>
                <p className="page-subtitle">Planner will rewire the DAG without restarting the mission.</p>
              </div>
              <span className="injection-status">EVENT DRIVEN</span>
            </div>
            <div className="injection-input-row">
              <input value={draftRequirement} onChange={(e) => setDraftRequirement(e.target.value)} placeholder="Add a new requirement" />
              <Button size="sm" onClick={handleInject} disabled={loading}>
                {loading ? "Injecting" : "Inject"}
              </Button>
            </div>
            {mission.dynamicRequirements.length ? (
              <div className="injection-success">{mission.dynamicRequirements[mission.dynamicRequirements.length - 1]}</div>
            ) : null}
          </div>

          <div className="activity-list">
            {mission.events.length ? (
              mission.events.slice().reverse().slice(0, 8).map((event) => (
                <div key={event.id} className="activity-item">
                  <div className="activity-icon"><Activity size={12} /></div>
                  <div>
                    <div className="activity-meta">
                      <strong>{event.type.toUpperCase()}</strong>
                      <span>{formatTime(event.timestamp)}</span>
                    </div>
                    <p>{event.message}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="activity-empty">
                <Activity size={24} />
                <strong>No activity yet</strong>
                <p>The engine will populate this panel as nodes start executing.</p>
              </div>
            )}
          </div>

          <div className="runtime-panel">
            <div className="runtime-row"><span>Selected agents</span><strong>{mission.selectedAgents.length}</strong></div>
            <div className="runtime-row"><span>Confidence</span><strong>{mission.report?.confidence ? `${Math.round(mission.report.confidence * 100)}%` : "Pending"}</strong></div>
            <div className="runtime-row"><span>Verification</span><strong>{mission.report?.verification.status ?? "Pending"}</strong></div>
            <div className="runtime-row"><span>Status</span><StatusChip status={mission.status} /></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function isActiveEdge(mission: MissionRecord, source: string, target: string) {
  const sourceNode = mission.workflow.nodes.find((n) => n.id === source);
  const targetNode = mission.workflow.nodes.find((n) => n.id === target);
  return (
    (sourceNode?.status === "completed" || sourceNode?.status === "recovered") &&
    (targetNode?.status === "running" || targetNode?.status === "pending")
  );
}

function WorkflowStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="workflow-stat">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
