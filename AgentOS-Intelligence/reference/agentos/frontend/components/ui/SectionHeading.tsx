import { type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  icon,
  right,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        {eyebrow && (
          <span className="text-[9px] font-extrabold uppercase tracking-[1.6px] text-[#7f8492]">
            {eyebrow}
          </span>
        )}
        <h2 className="mt-1 flex items-center gap-2 text-[17px] font-semibold text-white">
          {icon && <span className="text-violet-400">{icon}</span>}
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-xs text-[#7e8797]">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
