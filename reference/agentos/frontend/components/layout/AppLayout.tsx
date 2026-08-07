import {
  Activity,
  Bot,
  Brain,
  LayoutDashboard,
  Network,
  Plus,
  Settings,
  Shield,
  Store,
} from "lucide-react";

import { NavLink, Outlet, useLocation } from "react-router-dom";

const navItems = [
  { name: "Command Center", path: "/app", icon: LayoutDashboard, end: true },
  { name: "New Mission", path: "/app/missions/new", icon: Plus },
  { name: "Workflows", path: "/app/workflows", icon: Network },
  { name: "Agent Store", path: "/app/agents/store", icon: Store },
  { name: "Memory", path: "/app/memory", icon: Brain },
  { name: "Observability", path: "/app/observability", icon: Activity },
  { name: "Security", path: "/app/security", icon: Shield },
  { name: "Settings", path: "/app/settings", icon: Settings },
];

function useBreadcrumb(pathname: string): string[] {
  const segments = pathname.replace("/app", "").split("/").filter(Boolean);

  if (segments.length === 0) return ["Command Center"];

  const labels: Record<string, string> = {
    agents: "Agent Store",
    missions: "New Mission",
    workflows: "Workflows",
    reports: "Mission Report",
    memory: "Shared Memory",
    observability: "Observability",
    security: "Security Center",
    settings: "Settings",
    new: "New Mission",
  };

  const crumbs = segments.map((seg) => labels[seg] ?? seg);
  // For workflow/report IDs, show the ID segment as-is.
  return crumbs;
}

export function AppLayout() {
  const { pathname } = useLocation();
  const breadcrumb = useBreadcrumb(pathname);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Bot size={20} />
          </div>

          <div>
            <strong>AgentOS</strong>
            <span>CONTROL PLANE</span>
          </div>
        </div>

        <div className="sidebar-section-title">WORKSPACE</div>

        <nav className="sidebar-nav">
          {navItems.map(({ name, path, icon: Icon, end }) => (
            <NavLink
              key={name}
              to={path}
              end={end}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              <span>{name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-status">
          <span className="green-dot" />

          <div>
            <strong>System Operational</strong>
            <span>Demo Simulation</span>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <div>
            <span className="breadcrumb">
              AGENTOS / {breadcrumb.join(" / ").toUpperCase()}
            </span>
          </div>

          <div className="topbar-status">
            <span className="green-dot" />
            ALL SYSTEMS OPERATIONAL
          </div>
        </header>

        <div className="app-page page-transition" key={pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
