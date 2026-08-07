import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Factory,
  FileText,
  Bot,
  Wrench,
  ShieldCheck,
  Network,
  BrainCircuit,
  SearchCheck,
  Bell,
  Settings,
  Flame,
  ClipboardCheck,
  PencilRuler,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', label: 'Command Center', icon: LayoutDashboard },
  { to: '/assets', label: 'Assets', icon: Factory },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/rag-search', label: 'RAG Search', icon: SearchCheck },
  { to: '/memory', label: 'Memory', icon: BrainCircuit },
  { to: '/drawings', label: 'Engineering Drawings', icon: PencilRuler },
  { to: '/copilot', label: 'AI Copilot', icon: Bot },
  { to: '/maintenance', label: 'Maintenance Intelligence', icon: Wrench },
  { to: '/compliance', label: 'Compliance', icon: ShieldCheck },
  { to: '/qms', label: 'Quality (QMS)', icon: ClipboardCheck },
  { to: '/knowledge-graph', label: 'Knowledge Graph', icon: Network },
  { to: '/alerts', label: 'Alerts', icon: Bell },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <aside className="flex h-full w-60 flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-orange-500 to-orange-600 shadow-sm">
          <Flame className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col leading-tight">
<span className="text-sm font-semibold text-white tracking-tight">AgentOS</span>
          <span className="text-[10px] text-slate-400">Organizational Intelligence</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            location.pathname === item.to ||
            (item.to !== '/dashboard' && location.pathname.startsWith(item.to));
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/5 px-3 py-3">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
              isActive
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
            )
          }
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </NavLink>
        <div className="mt-3 px-3 py-2 rounded-md bg-white/5">
          <p className="text-[10px] text-slate-500 leading-relaxed">
            AstraForge Process Industries
            <br />
            Vadodara, Gujarat
          </p>
        </div>
      </div>
    </aside>
  );
}
