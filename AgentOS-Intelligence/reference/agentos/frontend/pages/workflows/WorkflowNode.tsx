import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Bot, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";
import type { WorkflowNode as WorkflowNodeData } from "../../types";

export type WorkflowNodeType = NodeProps & {
  data: {
    node: WorkflowNodeData;
  };
};

function iconFor(status: string, capability: string) {
  if (status === "recovered") return <RefreshCcw size={14} />;
  if (status === "failed") return <Sparkles size={14} />;
  if (capability === "verification") return <ShieldCheck size={14} />;
  return <Bot size={14} />;
}

function WorkflowNodeView({ data }: WorkflowNodeType) {
  const node = data.node;
  const status = node.status;

  const statusClass =
    status === "running"
      ? "rf-node-running"
      : status === "completed"
        ? "rf-node-completed"
        : status === "recovered"
          ? "rf-node-recovered"
          : status === "failed"
            ? "rf-node-failed"
            : "rf-node-pending";

  return (
    <div className={`wf-node ${statusClass}`}>
      <Handle type="target" position={Position.Left} className="wf-handle" />
      <div className="wf-node-top">
        <div className="wf-node-icon">{iconFor(status, node.capability)}</div>
        <span className={`wf-node-status wf-status-${status}`}>{status.toUpperCase()}</span>
      </div>
      <strong className="wf-node-name">{node.name}</strong>
      <p className="wf-node-desc">{node.description}</p>

      {node.selectedAgentId && (
        <div className="wf-node-agent">
          <span>AGENT</span>
          <strong>{node.selectedAgentId}</strong>
        </div>
      )}

      <div className="wf-node-confidence">
        <span>CONFIDENCE</span>
        <strong>{Math.round(node.confidence * 100)}%</strong>
      </div>

      {node.recoveryCount > 0 && (
        <div className="wf-node-recovery">
          <RefreshCcw size={10} />
          {node.recoveryCount} recovery
        </div>
      )}

      <Handle type="source" position={Position.Right} className="wf-handle" />
    </div>
  );
}

export default memo(WorkflowNodeView);
export const workflowNodeTypes = { agent: WorkflowNodeView };
