import type { AgentDefinition } from './types';

export const agentRegistry: AgentDefinition[] = [
  {
    id: 'orchestrator', name: 'Orchestrator', description: 'Plans tasks and routes work to specialized agents.',
    category: 'planning', capabilities: ['planning', 'routing', 'decomposition'], permissions: ['plan', 'route'],
    cost: 4, latency: 2, accuracy: 9.2, reliability: 9.4, status: 'online', provider: 'adapter', model: 'configurable', health: 100,
  },
  {
    id: 'rag-agent', name: 'RAG Agent', description: 'Retrieves grounded organizational knowledge.',
    category: 'retrieval', capabilities: ['rag', 'retrieval', 'citations'], permissions: ['read_knowledge'],
    cost: 2, latency: 2, accuracy: 9.0, reliability: 9.2, status: 'online', provider: 'internal', model: 'hybrid-rag', health: 100,
  },
  {
    id: 'research-agent', name: 'Research Agent', description: 'Synthesizes evidence into structured findings.',
    category: 'research', capabilities: ['research', 'analysis', 'synthesis'], permissions: ['read_knowledge', 'analyze'],
    cost: 5, latency: 3, accuracy: 8.9, reliability: 9.0, status: 'online', provider: 'adapter', model: 'configurable', health: 100,
  },
  {
    id: 'social-agent', name: 'Social Media Agent', description: 'Creates channel-specific content from verified organizational evidence.',
    category: 'social', capabilities: ['linkedin', 'instagram', 'x', 'campaigns', 'brand'], permissions: ['read_knowledge', 'draft_social'],
    cost: 4, latency: 2, accuracy: 8.8, reliability: 8.9, status: 'online', provider: 'adapter', model: 'configurable', health: 100,
  },
  {
    id: 'verifier-agent', name: 'Verifier', description: 'Checks claims against evidence before approval or memory write-back.',
    category: 'verification', capabilities: ['verification', 'grounding', 'consensus'], permissions: ['read_knowledge', 'verify'],
    cost: 4, latency: 2, accuracy: 9.4, reliability: 9.5, status: 'online', provider: 'adapter', model: 'configurable', health: 100,
  },
];

export function scoreAgent(agent: AgentDefinition, requiredCapabilities: string[]): number {
  const capabilityMatch = requiredCapabilities.length === 0
    ? 1
    : requiredCapabilities.filter((c) => agent.capabilities.includes(c)).length / requiredCapabilities.length;
  const availability = agent.status === 'online' ? 1 : agent.status === 'degraded' ? 0.5 : 0;
  return (
    0.40 * capabilityMatch +
    0.20 * (agent.reliability / 10) +
    0.20 * (agent.accuracy / 10) +
    0.10 * availability -
    0.05 * Math.min(agent.latency / 10, 1) -
    0.05 * Math.min(agent.cost / 10, 1)
  );
}

export function selectAgent(requiredCapabilities: string[]): AgentDefinition | undefined {
  return [...agentRegistry]
    .filter((agent) => agent.status !== 'offline')
    .sort((a, b) => scoreAgent(b, requiredCapabilities) - scoreAgent(a, requiredCapabilities))[0];
}
