import type { TaskContext } from './types';

export function createTaskContext(userQuery: string): TaskContext {
  return {
    taskId: crypto.randomUUID(),
    userQuery,
    retrievedEvidence: [],
    agentOutputs: [],
    discoveredEntities: [],
    confidence: 0,
    status: 'planning',
  };
}
