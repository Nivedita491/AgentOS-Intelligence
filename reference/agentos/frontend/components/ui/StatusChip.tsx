import { cn } from "../../lib/utils";
import type { AgentStatus, MissionStatus, NodeStatus } from "../../types";

type StatusType = AgentStatus | MissionStatus | NodeStatus;

const toneMap: Record<string, string> = {
  online: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
  completed: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
  recovered: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
  created: "text-sky-300 bg-sky-500/10 border-sky-500/25",
  running: "text-violet-300 bg-violet-500/10 border-violet-500/25",
  degraded: "text-amber-300 bg-amber-500/10 border-amber-500/25",
  pending: "text-slate-300 bg-slate-500/10 border-slate-500/25",
  failed: "text-red-300 bg-red-500/10 border-red-500/25",
  offline: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  completed_with_recovery: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
};

const dotMap: Record<string, string> = {
  online: "bg-emerald-400",
  completed: "bg-emerald-400",
  recovered: "bg-emerald-400",
  created: "bg-sky-400",
  running: "bg-violet-400",
  degraded: "bg-amber-400",
  pending: "bg-slate-400",
  failed: "bg-red-400",
  offline: "bg-slate-500",
  completed_with_recovery: "bg-emerald-400",
};

export function StatusChip({ status }: { status: StatusType }) {
  const label = status.replace(/_/g, " ").toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-[1px]",
        toneMap[status] ?? "text-slate-300 bg-slate-500/10 border-slate-500/25",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotMap[status] ?? "bg-slate-400")} />
      {label}
    </span>
  );
}
