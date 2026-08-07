import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

export function MetricCard({
  label,
  value,
  icon: Icon,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sub?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const toneMap: Record<string, string> = {
    default: 'text-slate-500 bg-slate-50',
    success: 'text-emerald-600 bg-emerald-50',
    warning: 'text-amber-600 bg-amber-50',
    danger: 'text-red-600 bg-red-50',
    info: 'text-blue-600 bg-blue-50',
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-slate-500">{label}</span>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-md', toneMap[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold text-slate-800 tabular-nums">{value}</span>
        {sub && <span className="text-[11px] text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {description && <p className="text-[13px] text-slate-500 mt-0.5">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/50 py-12 px-6 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="mt-1 text-[13px] text-slate-400 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50/50 py-10 px-6 text-center">
      <p className="text-sm font-medium text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-[13px] font-medium text-red-700 hover:bg-red-50 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function Card({
  title,
  children,
  className,
  action,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          {title && <h3 className="text-[13px] font-semibold text-slate-700">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function LoadingRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="h-4 flex-1 animate-pulse rounded bg-slate-100"
              style={{ animationDelay: `${(i + j) * 60}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function LoadingCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
      <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-100" />
    </div>
  );
}
