// Centralized AgentOS domain types — single source of truth for frontend.

export type NodeStatus = "pending" | "running" | "completed" | "recovered" | "failed";
export type MissionStatus =
  | "created"
  | "running"
  | "completed"
  | "completed_with_recovery"
  | "failed";
export type AgentStatus = "online" | "degraded" | "offline";
export type EventType = "planner" | "agent" | "recovery" | "verification" | "report";

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  permissions: string[];
  cost: number;
  latency: number;
  accuracy: number;
  reliability: number;
  status: AgentStatus;
  provider: string;
  model: string;
  health: number;
}

export interface WorkflowNode {
  id: string;
  name: string;
  description: string;
  capability: string;
  category: string;
  status: NodeStatus;
  confidence: number;
  evidence: string;
  claim: string;
  recommendation: string;
  assumptions: string[];
  risks: string[];
  selectedAgentId?: string;
  selectedReason?: string;
  dependencies: string[];
  attempts: number;
  recoveryCount: number;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface MissionEvent {
  id: string;
  type: EventType;
  message: string;
  timestamp: string;
}

export interface MissionMetrics {
  latency: number;
  cost: number;
  tokens: number;
  executionTime: number;
  recoveryCount: number;
  failures: number;
}

export interface MissionReport {
  executiveSummary: string;
  agentContributions: Array<{ name: string; contribution: string }>;
  executionTimeline: string[];
  failures: string[];
  recovery: string[];
  confidence: number;
  evidence: string[];
  debate: {
    consensus: string;
    contradictions: string[];
  };
  verification: {
    status: "Verified" | "Partially Verified" | "Needs Review";
    notes: string[];
  };
  risks: string[];
  recommendations: string[];
}

export interface MissionRecord {
  missionId: string;
  objective: string;
  status: MissionStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  progress: number;
  workflow: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
  events: MissionEvent[];
  metrics: MissionMetrics;
  report?: MissionReport;
  dynamicRequirements: string[];
  selectedAgents: Array<{ nodeId: string; agentId: string; reason: string }>;
}

export interface DashboardData {
  missions: number;
  activeMissions: number;
  successRate: number;
  failures: number;
  recoveryCount: number;
  totalCost: number;
  totalTokens: number;
  recentMissions: Array<{
    missionId: string;
    objective: string;
    status: MissionStatus;
    progress: number;
  }>;
}

export const AGENT_STATUS_ORDER: Record<AgentStatus, number> = {
  online: 1,
  degraded: 2,
  offline: 3,
};
