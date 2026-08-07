import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glow?: boolean;
  interactive?: boolean;
}

export function GlassCard({
  children,
  className,
  glow = false,
  interactive = false,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-white/[0.06] bg-[rgba(13,15,22,0.72)] backdrop-blur-xl",
        "shadow-[0_20px_60px_rgba(0,0,0,0.35)]",
        glow && "before:absolute before:inset-0 before:-z-10 before:rounded-2xl before:bg-gradient-to-br before:from-violet-500/10 before:to-indigo-500/5 before:blur-2xl",
        interactive && "transition-all duration-300 hover:border-white/[0.12] hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(0,0,0,0.45)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
