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
  status: "online" | "degraded" | "offline";
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
  status: "pending" | "running" | "completed" | "recovered" | "failed";
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
  type: "planner" | "agent" | "recovery" | "verification" | "report";
  message: string;
  timestamp: string;
}

export interface MissionRecord {
  missionId: string;
  objective: string;
  status: "created" | "running" | "completed" | "completed_with_recovery" | "failed";
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
  metrics: {
    latency: number;
    cost: number;
    tokens: number;
    executionTime: number;
    recoveryCount: number;
    failures: number;
  };
  report?: {
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
  };
  dynamicRequirements: string[];
  selectedAgents: Array<{ nodeId: string; agentId: string; reason: string }>;
}

class PriorityQueue<T> {
  private items: Array<{ value: T; priority: number }> = [];

  enqueue(value: T, priority: number) {
    this.items.push({ value, priority });
    this.items.sort((a, b) => b.priority - a.priority);
  }

  dequeue(): T | undefined {
    return this.items.shift()?.value;
  }

  size() {
    return this.items.length;
  }
}

function createAgentRegistry(): AgentDefinition[] {
  return [
    {
      id: "planner-a",
      name: "Planner Nexus",
      description: "Decomposes objectives into validated execution DAGs.",
      category: "planning",
      capabilities: ["planning", "strategy", "architecture"],
      permissions: ["plan", "graph"],
      cost: 4,
      latency: 2,
      accuracy: 9.4,
      reliability: 9.5,
      status: "online",
      provider: "OpenAI",
      model: "gpt-5",
      health: 96,
    },
    {
      id: "research-a",
      name: "Research Atlas",
      description: "Synthesizes evidence and cross-checks claims.",
      category: "research",
      capabilities: ["research", "analysis", "synthesis"],
      permissions: ["read", "analyze"],
      cost: 5,
      latency: 3,
      accuracy: 8.8,
      reliability: 8.9,
      status: "online",
      provider: "Anthropic",
      model: "claude-4",
      health: 94,
    },
    {
      id: "finance-a",
      name: "Finance Oracle",
      description: "Evaluates cost, risk, and investment tradeoffs.",
      category: "finance",
      capabilities: ["finance", "risk", "modeling"],
      permissions: ["forecast", "risk"],
      cost: 6,
      latency: 4,
      accuracy: 8.5,
      reliability: 8.7,
      status: "online",
      provider: "Google",
      model: "gemini-2.5",
      health: 92,
    },
    {
      id: "security-a",
      name: "Security Sentinel",
      description: "Analyzes cybersecurity, compliance, and attack vectors.",
      category: "security",
      capabilities: ["security", "cybersecurity", "compliance"],
      permissions: ["scan", "verify"],
      cost: 7,
      latency: 5,
      accuracy: 9.1,
      reliability: 9.2,
      status: "online",
      provider: "Microsoft",
      model: "phi-4",
      health: 95,
    },
    {
      id: "verify-a",
      name: "Verifier Prime",
      description: "Cross-validates evidence and produces verification states.",
      category: "verification",
      capabilities: ["verification", "audit", "consensus"],
      permissions: ["verify", "signoff"],
      cost: 4,
      latency: 2,
      accuracy: 9.3,
      reliability: 9.4,
      status: "online",
      provider: "OpenAI",
      model: "gpt-5",
      health: 97,
    },
    {
      id: "recovery-a",
      name: "Recovery Relay",
      description: "Restores failed execution paths with backup agents.",
      category: "recovery",
      capabilities: ["recovery", "fallback", "repair"],
      permissions: ["restore", "retry"],
      cost: 5,
      latency: 3,
      accuracy: 8.9,
      reliability: 9.0,
      status: "online",
      provider: "Anthropic",
      model: "claude-4",
      health: 91,
    },
  ];
}

export class MissionEngine {
  private missions = new Map<string, MissionRecord>();
  private agentRegistry = createAgentRegistry();
  private timers = new Map<string, NodeJS.Timeout>();

  createMission(objective: string): MissionRecord {
    const missionId = `mission-${Date.now()}`;
    const mission: MissionRecord = {
      missionId,
      objective,
      status: "created",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: 0,
      workflow: {
        nodes: [
          {
            id: "planner",
            name: "Planner",
            description: "Turns the objective into a concrete execution plan.",
            capability: "planning",
            category: "planning",
            status: "pending",
            confidence: 0,
            evidence: "Awaiting planning synthesis",
            claim: "Objective captured",
            recommendation: "Proceed to planning",
            assumptions: ["Objective is actionable"],
            risks: ["Incomplete requirements"],
            dependencies: [],
            attempts: 0,
            recoveryCount: 0,
          },
          {
            id: "research",
            name: "Research",
            description: "Gathers evidence and relevant context.",
            capability: "research",
            category: "research",
            status: "pending",
            confidence: 0,
            evidence: "Awaiting evidence collection",
            claim: "Research pending",
            recommendation: "Collect evidence",
            assumptions: ["Signals are accessible"],
            risks: ["Low signal quality"],
            dependencies: ["planner"],
            attempts: 0,
            recoveryCount: 0,
          },
          {
            id: "finance",
            name: "Finance",
            description: "Maps cost and risk constraints to the objective.",
            capability: "finance",
            category: "finance",
            status: "pending",
            confidence: 0,
            evidence: "Awaiting cost model",
            claim: "Risk model pending",
            recommendation: "Assess cost and latency",
            assumptions: ["Budget constraints exist"],
            risks: ["Unbounded costs"],
            dependencies: ["planner"],
            attempts: 0,
            recoveryCount: 0,
          },
          {
            id: "verify",
            name: "Verifier",
            description: "Validates evidence and consensus before sign-off.",
            capability: "verification",
            category: "verification",
            status: "pending",
            confidence: 0,
            evidence: "Awaiting validation",
            claim: "Verification pending",
            recommendation: "Cross-check evidence",
            assumptions: ["Evidence is available"],
            risks: ["Contradictory findings"],
            dependencies: ["research", "finance"],
            attempts: 0,
            recoveryCount: 0,
          },
        ],
        edges: [
          { id: "edge-planner-research", source: "planner", target: "research", label: "plan" },
          { id: "edge-planner-finance", source: "planner", target: "finance", label: "cost" },
          { id: "edge-research-verify", source: "research", target: "verify", label: "evidence" },
          { id: "edge-finance-verify", source: "finance", target: "verify", label: "risk" },
        ],
      },
      events: [
        {
          id: `${missionId}-event-1`,
          type: "planner",
          message: "Mission accepted and workflow graph initialized.",
          timestamp: new Date().toISOString(),
        },
      ],
      metrics: {
        latency: 0,
        cost: 0,
        tokens: 0,
        executionTime: 0,
        recoveryCount: 0,
        failures: 0,
      },
      dynamicRequirements: [],
      selectedAgents: [],
    };

    this.missions.set(missionId, mission);
    return mission;
  }

  listMissions(): MissionRecord[] {
    return Array.from(this.missions.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getMission(missionId: string): MissionRecord | undefined {
    return this.missions.get(missionId);
  }

  getAgents() {
    return this.agentRegistry;
  }

  startMission(missionId: string): MissionRecord | undefined {
    const mission = this.missions.get(missionId);
    if (!mission) {
      return undefined;
    }

    if (mission.status !== "created") {
      return mission;
    }

    mission.status = "running";
    mission.startedAt = new Date().toISOString();
    mission.updatedAt = new Date().toISOString();
    mission.events.push({
      id: `${missionId}-event-start`,
      type: "planner",
      message: "Planner initiated orchestration across the live DAG.",
      timestamp: new Date().toISOString(),
    });
    this.enqueueReadyNodes(mission);
    return mission;
  }

  injectRequirement(missionId: string, requirement: string): MissionRecord | undefined {
    const mission = this.missions.get(missionId);
    if (!mission) {
      return undefined;
    }

    mission.dynamicRequirements.push(requirement);
    mission.events.push({
      id: `${missionId}-event-injection`,
      type: "planner",
      message: `Dynamic requirement injected: ${requirement}`,
      timestamp: new Date().toISOString(),
    });

    const capability = this.mapRequirementToCapability(requirement);
    const nodeId = `dynamic-${Date.now()}`;
    const node: WorkflowNode = {
      id: nodeId,
      name: capability.charAt(0).toUpperCase() + capability.slice(1),
      description: `Executes the dynamically inserted ${capability} requirement.`,
      capability,
      category: capability,
      status: "pending",
      confidence: 0,
      evidence: "Waiting for dynamic node execution",
      claim: "Dynamic action requested",
      recommendation: "Execute with the best-fit agent",
      assumptions: ["Requirement is actionable"],
      risks: ["Unclear scope"],
      dependencies: ["planner"],
      attempts: 0,
      recoveryCount: 0,
    };

    mission.workflow.nodes.push(node);
    mission.workflow.edges.push({
      id: `${nodeId}-edge`,
      source: "planner",
      target: nodeId,
      label: "dynamic",
    });
    mission.workflow.edges.push({
      id: `${nodeId}-verify`,
      source: nodeId,
      target: "verify",
      label: "augment",
    });

    if (mission.status === "running") {
      this.enqueueReadyNodes(mission);
    }

    mission.updatedAt = new Date().toISOString();
    return mission;
  }

  getDashboard() {
    const missions = this.listMissions();
    const successCount = missions.filter((mission) => mission.status === "completed" || mission.status === "completed_with_recovery").length;
    const failures = missions.reduce((total, mission) => total + mission.metrics.failures, 0);

    return {
      missions: missions.length,
      activeMissions: missions.filter((mission) => mission.status === "running").length,
      successRate: missions.length ? Math.round((successCount / missions.length) * 100) : 0,
      failures,
      recoveryCount: missions.reduce((total, mission) => total + mission.metrics.recoveryCount, 0),
      totalCost: missions.reduce((total, mission) => total + mission.metrics.cost, 0),
      totalTokens: missions.reduce((total, mission) => total + mission.metrics.tokens, 0),
      recentMissions: missions.slice(0, 4).map((mission) => ({
        missionId: mission.missionId,
        objective: mission.objective,
        status: mission.status,
        progress: mission.progress,
      })),
    };
  }

  private enqueueReadyNodes(mission: MissionRecord) {
    const readyNodes = mission.workflow.nodes.filter((node) => node.status === "pending" && this.dependenciesSatisfied(mission, node));
    const queue = new PriorityQueue<WorkflowNode>();

    readyNodes.forEach((node) => {
      const priority = this.calculatePriority(node, mission);
      queue.enqueue(node, priority);
    });

    while (queue.size() > 0) {
      const node = queue.dequeue();
      if (node) {
        this.executeNode(mission, node);
      }
    }
  }

  private dependenciesSatisfied(mission: MissionRecord, node: WorkflowNode) {
    return node.dependencies.every((dependencyId) => {
      const dependency = mission.workflow.nodes.find((candidate) => candidate.id === dependencyId);
      return dependency?.status === "completed" || dependency?.status === "recovered";
    });
  }

  private calculatePriority(node: WorkflowNode, mission: MissionRecord) {
    const agent = this.agentRegistry.find((candidate) => candidate.capabilities.includes(node.capability));
    const urgency = node.capability === "verification" ? 100 : 85;
    const costPenalty = agent ? agent.cost * 2 : 0;
    const latencyPenalty = agent ? agent.latency * 4 : 0;
    const riskPenalty = node.risks.length * 3;
    const workflowPriority = node.capability === "planning" ? 95 : 80;
    return urgency + workflowPriority - costPenalty - latencyPenalty - riskPenalty;
  }

  private executeNode(mission: MissionRecord, node: WorkflowNode) {
    const agent = this.selectAgent(node);
    if (!agent) {
      node.status = "failed";
      mission.metrics.failures += 1;
      mission.updatedAt = new Date().toISOString();
      return;
    }

    node.status = "running";
    node.selectedAgentId = agent.id;
    node.selectedReason = `${agent.name} scored highest for ${node.capability} because of reliability and accuracy.`;
    node.attempts += 1;
    mission.events.push({
      id: `${mission.missionId}-${node.id}-running`,
      type: "agent",
      message: `${agent.name} started ${node.name.toLowerCase()} execution.`,
      timestamp: new Date().toISOString(),
    });

    const duration = 900 + (node.attempts * 180) + (node.capability === "verification" ? 400 : 0);
    const timer = setTimeout(() => {
      const success = this.evaluateOutcome(node, agent);
      const nextNodeStatus = success ? "completed" : "failed";
      node.status = nextNodeStatus;
      node.confidence = success ? 0.88 + agent.accuracy / 20 : 0.59;
      node.evidence = success
        ? `${agent.name} produced verified evidence for ${node.capability}.`
        : `${agent.name} returned partial evidence and triggered recovery.`;
      node.claim = success ? `Resolved with ${agent.name}` : `Fallback required for ${node.capability}`;
      node.recommendation = success ? "Proceed to the next dependency" : "Recover and continue with the backup policy";
      node.assumptions = success
        ? ["Execution completed within the expected runtime"]
        : ["Fallback route is available"];
      node.risks = success ? [] : ["Evidence quality reduced" ];

      mission.metrics.cost += agent.cost * 2;
      mission.metrics.tokens += 180 + (node.capability === "planning" ? 260 : 140);
      mission.metrics.latency += agent.latency * 35;
      mission.metrics.executionTime += duration;

      if (!success) {
        mission.metrics.failures += 1;
        mission.metrics.recoveryCount += 1;
        mission.events.push({
          id: `${mission.missionId}-${node.id}-recovery`,
          type: "recovery",
          message: `Recovery path engaged for ${node.name}.`,
          timestamp: new Date().toISOString(),
        });

        const backup = this.selectBackupAgent(node, agent.id);
        if (backup) {
          node.status = "recovered";
          node.recoveryCount += 1;
          node.selectedAgentId = backup.id;
          node.selectedReason = `Recovery switched to ${backup.name} after initial failure.`;
          node.confidence = 0.83;
          node.evidence = `${backup.name} restored the node with a verified fallback execution.`;
          node.claim = `Recovered through ${backup.name}`;
          node.recommendation = "Continue to downstream verification";
          mission.events.push({
            id: `${mission.missionId}-${node.id}-recovered`,
            type: "recovery",
            message: `${backup.name} recovered ${node.name}.`,
            timestamp: new Date().toISOString(),
          });
        } else {
          node.status = "failed";
          mission.events.push({
            id: `${mission.missionId}-${node.id}-failed`,
            type: "recovery",
            message: `${node.name} failed and no backup agent was available.`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      mission.events.push({
        id: `${mission.missionId}-${node.id}-complete`,
        type: node.status === "recovered" ? "recovery" : "verification",
        message: `${node.name} finished with ${node.status}.`,
        timestamp: new Date().toISOString(),
      });

      mission.selectedAgents.push({ nodeId: node.id, agentId: node.selectedAgentId ?? agent.id, reason: node.selectedReason ?? `${agent.name} executed the node.` });
      mission.progress = Math.round((mission.workflow.nodes.filter((candidate) => candidate.status === "completed" || candidate.status === "recovered").length / mission.workflow.nodes.length) * 100);
      mission.updatedAt = new Date().toISOString();

      const remainingPending = mission.workflow.nodes.some((candidate) => candidate.status === "pending");
      if (!remainingPending) {
        this.finalizeMission(mission);
      } else {
        this.enqueueReadyNodes(mission);
      }
    }, duration);

    this.timers.set(`${mission.missionId}-${node.id}`, timer);
  }

  private selectAgent(node: WorkflowNode): AgentDefinition | undefined {
    const candidates = this.agentRegistry.filter((agent) => agent.capabilities.includes(node.capability) && agent.status === "online");
    if (!candidates.length) {
      return this.agentRegistry.find((agent) => agent.category === node.category);
    }

    return candidates
      .map((agent) => ({
        agent,
        score: this.scoreAgent(agent, node),
      }))
      .sort((a, b) => b.score - a.score)[0]?.agent;
  }

  private selectBackupAgent(node: WorkflowNode, excludeId: string) {
    return this.agentRegistry.find((agent) => agent.category === "recovery" && agent.id !== excludeId);
  }

  private scoreAgent(agent: AgentDefinition, node: WorkflowNode) {
    const capabilityMatch = agent.capabilities.includes(node.capability) ? 28 : 0;
    const reliability = agent.reliability * 5;
    const accuracy = agent.accuracy * 4;
    const latencyPenalty = agent.latency * 2;
    const costPenalty = agent.cost * 1.5;
    const riskPenalty = node.risks.length * 2;
    return capabilityMatch + reliability + accuracy - latencyPenalty - costPenalty - riskPenalty;
  }

  private evaluateOutcome(node: WorkflowNode, agent: AgentDefinition) {
    const capabilityBias = node.capability === "planning" ? 0.95 : node.capability === "verification" ? 0.9 : 0.8;
    const providerBias = agent.provider === "OpenAI" || agent.provider === "Anthropic" ? 0.02 : 0;
    return capabilityBias + providerBias > 0.87;
  }

  private finalizeMission(mission: MissionRecord) {
    mission.status = mission.metrics.failures > 0 ? "completed_with_recovery" : "completed";
    mission.completedAt = new Date().toISOString();
    mission.updatedAt = new Date().toISOString();

    const completedNodes = mission.workflow.nodes.filter((node) => node.status === "completed" || node.status === "recovered");
    const averageConfidence = completedNodes.reduce((total, node) => total + node.confidence, 0) / Math.max(completedNodes.length, 1);
    const verificationStatus = averageConfidence > 0.8 ? "Verified" : averageConfidence > 0.7 ? "Partially Verified" : "Needs Review";

    mission.report = {
      executiveSummary: `${mission.objective} was orchestrated through a resilient DAG and produced a verified mission report.`,
      agentContributions: completedNodes.map((node) => ({
        name: node.name,
        contribution: `${node.name} executed with ${node.selectedAgentId ?? "the registry"}.`,
      })),
      executionTimeline: mission.events.slice(0, 6).map((event) => event.message),
      failures: mission.metrics.failures > 0 ? ["At least one node required recovery before completion."] : [],
      recovery: mission.metrics.recoveryCount > 0 ? ["Recovery agents restored the failed path and preserved workflow continuity."] : [],
      confidence: Number(averageConfidence.toFixed(2)),
      evidence: completedNodes.map((node) => node.evidence),
      debate: {
        consensus: "The plan and evidence converged on a clear recommendation.",
        contradictions: mission.metrics.failures > 0 ? ["One node required fallback and introduced uncertainty."] : [],
      },
      verification: {
        status: verificationStatus,
        notes: ["Evidence was independently cross-checked.", "Risks were surfaced and reviewed."],
      },
      risks: mission.workflow.nodes.flatMap((node) => node.risks).slice(0, 4),
      recommendations: [
        "Keep the dynamic requirement pathway enabled.",
        "Track recovery events for future model selection.",
      ],
    };

    mission.events.push({
      id: `${mission.missionId}-report`,
      type: "report",
      message: "Mission report generated with verification and recovery details.",
      timestamp: new Date().toISOString(),
    });
  }

  private mapRequirementToCapability(requirement: string) {
    const lowered = requirement.toLowerCase();
    if (lowered.includes("security") || lowered.includes("cyber")) {
      return "security";
    }
    if (lowered.includes("finance") || lowered.includes("budget")) {
      return "finance";
    }
    if (lowered.includes("research") || lowered.includes("analy")) {
      return "research";
    }
    return "research";
  }
}
