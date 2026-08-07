export type AgentStatus = 'online' | 'degraded' | 'offline';

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

export interface Evidence {
  id: string;
  content: string;
  documentId?: string;
  chunkId?: string;
  page?: number;
  score?: number;
  source?: string;
}

export interface AgentOutput {
  agentId: string;
  content: string;
  confidence: number;
  evidence: Evidence[];
  createdAt: string;
}

export interface TaskContext {
  taskId: string;
  userQuery: string;
  intent?: string;
  retrievedEvidence: Evidence[];
  agentOutputs: AgentOutput[];
  discoveredEntities: string[];
  confidence: number;
  status: 'planning' | 'retrieving' | 'reasoning' | 'verifying' | 'completed' | 'failed';
}
