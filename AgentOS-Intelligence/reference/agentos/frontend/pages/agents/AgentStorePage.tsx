import { useEffect, useMemo, useState } from "react";
import { Cpu, Search, ShieldCheck, Sparkles, Star } from "lucide-react";
import { getAgents } from "../../services/missionApi";
import type { AgentDefinition } from "../../types";
import { Badge, Button, StatCard } from "../../components/ui";

export function AgentStorePage() {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const data = await getAgents();
      setAgents(data);
    }
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.capabilities.some((c) => c.toLowerCase().includes(q)) ||
        a.provider.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
    );
  }, [agents, search]);

  return (
    <div className="mission-page">
      <div className="store-hero">
        <div>
          <span className="section-label">AGENT STORE</span>
          <h1>Install intelligence with confidence</h1>
          <p>Every agent is scored by capability match, reliability, accuracy, latency, cost, and risk.</p>
        </div>
        <div className="registry-status">
          <Sparkles size={12} />
          LIVE REGISTRY ONLINE
        </div>
      </div>

      <div className="store-stats">
        <StatCard label="AGENTS" value={agents.length} hint="Registered in the registry" accent="violet" />
        <StatCard label="HEALTHY" value={agents.filter((a) => a.status === "online").length} hint="Agents currently operational" accent="emerald" />
        <StatCard
          label="AVERAGE ACCURACY"
          value={agents.length ? `${(agents.reduce((t, a) => t + a.accuracy, 0) / agents.length).toFixed(1)}` : "0.0"}
          hint="Mean accuracy across registry"
          accent="sky"
        />
        <StatCard label="RISK MODEL" value="Adaptive" hint="Runtime scoring engine" accent="amber" />
      </div>

      <div className="store-toolbar">
        <div className="store-search">
          <Search size={15} />
          <input
            placeholder="Search by name, capability, provider, or category"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span>Score = capability match + reliability + accuracy − latency − cost − risk</span>
      </div>

      <div className="agent-store-grid">
        {filtered.length ? (
          filtered.map((agent) => {
            const score = agent.reliability * 5 + agent.accuracy * 4 - agent.latency * 2 - agent.cost * 1.5;
            const installed = agent.status !== "online";
            return (
              <article key={agent.id} className="store-agent-card">
                <div className="store-agent-top">
                  <div className="store-agent-icon">
                    <Cpu size={18} />
                  </div>
                  <Badge tone={agent.status === "online" ? "success" : "warning"}>{agent.category}</Badge>
                </div>

                <div className="store-agent-title">
                  <h3>{agent.name}</h3>
                  <ShieldCheck size={13} className="verified-icon" />
                </div>
                <span className="agent-creator">{agent.provider} &bull; {agent.model}</span>
                <p>{agent.description}</p>

                <div className="agent-capabilities">
                  {agent.capabilities.map((cap) => (
                    <span key={cap} className="capability-chip">{cap}</span>
                  ))}
                </div>

                <div className="agent-store-metrics">
                  <span><Star size={10} /> {agent.accuracy.toFixed(1)} accuracy</span>
                  <span><Cpu size={10} /> {agent.latency}ms</span>
                  <span><ShieldCheck size={10} /> {agent.health}% health</span>
                  <span className="score-badge">{Math.round(score)} score</span>
                </div>

                <Button variant="ghost" size="sm" className={installed ? "agent-installed-button" : "agent-install-button"}>
                  {installed ? "Installed" : "Install agent"}
                </Button>
              </article>
            );
          })
        ) : (
          <div className="activity-empty" style={{ gridColumn: "1 / -1" }}>
            <Search size={28} />
            <strong>No agents found</strong>
            <p>Try adjusting your search terms.</p>
          </div>
        )}
      </div>
    </div>
  );
}
