import { type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  animated?: boolean;
}

export function ProgressBar({
  value,
  animated = true,
  className,
  ...props
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn("h-[5px] w-full overflow-hidden rounded-full bg-[#151922]", className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      {...props}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-emerald-400 transition-[width] duration-700 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
