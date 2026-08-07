import { type ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { AlertSeverity } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function statusClass(status: string): string {
  const map: Record<string, string> = {
    Healthy: 'status-healthy',
    Monitor: 'status-monitor',
    'At Risk': 'status-at-risk',
    Critical: 'status-critical',
    Compliant: 'status-compliant',
    'Due Soon': 'status-due-soon',
    Overdue: 'status-overdue',
    'Missing Evidence': 'status-missing',
  };
  return map[status] ?? 'status-missing';
}

export function healthColor(score: number): string {
  if (score >= 85) return 'text-emerald-600';
  if (score >= 70) return 'text-amber-600';
  if (score >= 50) return 'text-orange-600';
  return 'text-red-600';
}

export function severityClass(severity: AlertSeverity): string {
  const map: Record<AlertSeverity, string> = {
    Low: 'status-healthy',
    Medium: 'status-monitor',
    High: 'status-at-risk',
    Critical: 'status-critical',
  };
  return map[severity];
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(d: string): string {
  const date = new Date(d);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function confidenceColor(level: string): string {
  if (level === 'high') return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (level === 'medium') return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-slate-600 bg-slate-50 border-slate-200';
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
