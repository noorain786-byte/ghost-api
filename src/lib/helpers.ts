import type { FaultType } from '@/lib/supabase';

export function faultBadgeClass(ft: string): string {
  switch (ft) {
    case 'latency': return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
    case 'http_500': return 'bg-rose-500/15 text-rose-300 border-rose-500/40';
    case 'http_503': return 'bg-orange-500/15 text-orange-300 border-orange-500/40';
    case 'timeout': return 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40';
    default: return 'bg-slate-700/40 text-slate-300 border-slate-600';
  }
}

export function faultShortLabel(ft: string): string {
  switch (ft) {
    case 'latency': return 'Latency';
    case 'http_500': return 'HTTP 500';
    case 'http_503': return 'HTTP 503';
    case 'timeout': return 'Timeout';
    case 'none': return 'None — Passed';
    default: return ft;
  }
}

export function faultFullLabel(ft: FaultType): string {
  switch (ft) {
    case 'latency': return 'Latency Spike';
    case 'http_500': return 'HTTP 500 Internal Server Error';
    case 'http_503': return 'HTTP 503 Service Unavailable';
    case 'timeout': return 'Network Timeout (5000ms)';
  }
}

export function statusBadgeClass(status: number): string {
  if (status >= 200 && status < 300) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
  if (status === 0) return 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40';
  return 'bg-rose-500/15 text-rose-300 border-rose-500/40';
}

export function statusLabel(status: number): string {
  if (status === 0) return 'TIMEOUT';
  if (status >= 200 && status < 300) return `${status} OK`;
  return `${status} CHAOS`;
}

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(0, Math.floor((now - d) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function randomSlug(): string {
  return 'g' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 5);
}
