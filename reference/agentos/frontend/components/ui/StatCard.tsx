import { type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: "violet" | "emerald" | "amber" | "sky" | "rose";
  className?: string;
}

const accentClasses = {
  violet: "text-violet-400",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  sky: "text-sky-400",
  rose: "text-rose-400",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "violet",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-sm",
        "transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.05]",
        className,
      )}
    >
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[1.5px] text-[#747d8d]">
        <span>{label}</span>
        {icon && <span className={cn("transition-transform duration-300 group-hover:scale-110", accentClasses[accent])}>{icon}</span>}
      </div>
      <strong className="mt-3 block text-[30px] font-semibold leading-none tracking-tight text-white">
        {value}
      </strong>
      {hint && <p className="mt-2 text-[10px] text-[#6f7786]">{hint}</p>}
    </div>
  );
}
