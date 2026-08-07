import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/utils";

type BadgeTone = "default" | "accent" | "success" | "warning" | "danger" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
}

const toneClasses: Record<BadgeTone, string> = {
  default: "bg-white/[0.04] text-[#aab3c2] border-white/[0.08]",
  accent: "bg-violet-500/10 text-violet-300 border-violet-500/25",
  success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  warning: "bg-amber-500/10 text-amber-300 border-amber-500/25",
  danger: "bg-red-500/10 text-red-300 border-red-500/25",
  info: "bg-sky-500/10 text-sky-300 border-sky-500/25",
};

const dotClasses: Record<BadgeTone, string> = {
  default: "bg-[#aab3c2]",
  accent: "bg-violet-400",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-red-400",
  info: "bg-sky-400",
};

export function Badge({
  children,
  tone = "default",
  dot = false,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[1px]",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dotClasses[tone])} />}
      {children}
    </span>
  );
}
