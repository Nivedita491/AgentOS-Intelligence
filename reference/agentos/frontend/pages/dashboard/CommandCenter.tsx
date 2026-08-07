import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  BrainCircuit,
  Clock,
  Network,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDashboard } from "../../services/missionApi";
import type { DashboardData } from "../../types";
import { Button, ProgressBar, StatCard, StatusChip } from "../../components/ui";

export function CommandCenter() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      const data = await getDashboard();
      if (!ignore) {
        setDashboard(data);
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 2000);

    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, []);

  const successData = [
    { name: "Success", value: dashboard?.successRate ?? 0, color: "#32d583" },
    { name: "Recovery", value: dashboard?.recoveryCount ?? 0, color: "#8b5cf6" },
    { name: "Remaining", value: Math.max(0, 100 - (dashboard?.successRate ?? 0)), color: "#1b1f28" },
  ];

  const activityData = [
    { name: "Missions", value: dashboard?.missions ?? 0 },
    { name: "Active", value: dashboard?.activeMissions ?? 0 },
    { name: "Failures", value: dashboard?.failures ?? 0 },
    { name: "Recovered", value: dashboard?.recoveryCount ?? 0 },
  ];

  return (
    <div className="mission-page">
      <div className="dashboard-heading">
        <div>
          <span className="section-label">AGENTOS COMMAND CENTER</span>
          <h1>Live mission orchestration</h1>
          <p>Every node, recovery, and verification step is driven by real engine state.</p>
        </div>

        <Link to="/app/missions/new">
          <Button>
            <Sparkles size={16} />
            New Mission
          </Button>
        </Link>
      </div>

      <div className="metrics-grid">
        <StatCard
          label="ACTIVE MISSIONS"
          value={dashboard?.activeMissions ?? 0}
          hint="Mission concurrency across the DAG"
          icon={<Activity size={16} />}
          accent="violet"
        />
        <StatCard
          label="SUCCESS RATE"
          value={`${dashboard?.successRate ?? 0}%`}
          hint="Verified completions with runtime recovery"
          icon={<ShieldCheck size={16} />}
          accent="emerald"
        />
        <StatCard
          label="RECOVERY EVENTS"
          value={dashboard?.recoveryCount ?? 0}
          hint="Fallback agents engaged during execution"
          icon={<BrainCircuit size={16} />}
          accent="sky"
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="section-label">MISSION FLOW</span>
              <h2>Live execution stream</h2>
            </div>
            <Network size={18} />
          </div>

          {dashboard?.recentMissions?.length ? (
            dashboard.recentMissions.map((mission) => (
              <Link to={`/app/workflows/${mission.missionId}`} key={mission.missionId} className="mission-row">
                <div className="mission-status">
                  <Bot size={18} />
                </div>

                <div className="mission-info">
                  <h3>{mission.objective}</h3>
                  <p>{mission.missionId}</p>
                  <ProgressBar value={mission.progress} />
                </div>

                <div className="mission-stats">
                  <strong>{mission.progress}%</strong>
                  <StatusChip status={mission.status} />
                </div>
              </Link>
            ))
          ) : (
            <div className="activity-empty">
              <Bot size={28} />
              <strong>No missions yet</strong>
              <p>Launch a new mission to populate the control plane.</p>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="section-label">OPERATIONS</span>
              <h2>System health</h2>
            </div>
            <Activity size={18} />
          </div>

          <div className="health-row">
            <span>Total missions</span>
            <strong>{dashboard?.missions ?? 0}</strong>
          </div>
          <div className="health-row">
            <span>Failures</span>
            <strong>{dashboard?.failures ?? 0}</strong>
          </div>
          <div className="health-row">
            <span>Cost</span>
            <strong>${(dashboard?.totalCost ?? 0).toFixed(1)}</strong>
          </div>
          <div className="health-row">
            <span>Tokens</span>
            <strong>{dashboard?.totalTokens ?? 0}</strong>
          </div>
          <div className="health-row">
            <span>Concurrency</span>
            <strong>{dashboard?.activeMissions ?? 0}</strong>
          </div>
        </section>
      </div>

      <div className="dashboard-charts">
        <section className="panel chart-panel">
          <div className="panel-header">
            <div>
              <span className="section-label">DISTRIBUTION</span>
              <h2>Outcome breakdown</h2>
            </div>
            <Zap size={18} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={activityData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
              >
                {activityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.name === "Active" ? "#8b5cf6" : entry.name === "Failures" ? "#f87171" : entry.name === "Recovered" ? "#32d583" : "#38bdf8"} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "rgba(8,10,15,0.95)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="chart-legend">
            {activityData.map((entry) => (
              <span key={entry.name}>
                <i style={{ background: entry.name === "Active" ? "#8b5cf6" : entry.name === "Failures" ? "#f87171" : entry.name === "Recovered" ? "#32d583" : "#38bdf8" }} />
                {entry.name} ({entry.value})
              </span>
            ))}
          </div>
        </section>

        <section className="panel chart-panel">
          <div className="panel-header">
            <div>
              <span className="section-label">PERFORMANCE</span>
              <h2>Success & recovery</h2>
            </div>
            <Clock size={18} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={successData}>
              <defs>
                <linearGradient id="violetGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1b1f28" />
              <XAxis dataKey="name" stroke="#5f6775" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#5f6775" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "rgba(8,10,15,0.95)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} fill="url(#violetGrad)" />
            </AreaChart>
          </ResponsiveContainer>
<div className="chart-legend">
            <span><i className="dot-violet" /> Aggregate score</span>
            <span><i className="dot-emerald" /> {dashboard ? "Operational" : "Booting"}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
