import { useCallback, useState } from 'react';
import { supabase, type RequestLog, type ChaosEndpoint, PROXY_BASE } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { faultBadgeClass, faultShortLabel, statusBadgeClass, statusLabel, fmtTime } from '@/lib/helpers';
import { Trash2, Zap, Loader2, Radio, Inbox } from 'lucide-react';

interface Props {
  logs: RequestLog[];
  endpoints: ChaosEndpoint[];
  onLogsChanged: () => void;
}

export default function LiveTraffic({ logs, endpoints, onLogsChanged }: Props) {
  const { user } = useAuth();
  const [clearing, setClearing] = useState(false);
  const [bursting, setBursting] = useState(false);
  const [burstId, setBurstId] = useState<string | null>(null);

  const epName = (id: string | null) => endpoints.find((e) => e.id === id)?.name ?? 'Unknown';

  async function clearLogs() {
    if (!user) return;
    setClearing(true);
    await supabase.from('request_logs').delete().eq('user_id', user.id);
    setClearing(false);
    onLogsChanged();
  }

  const simulateBurst = useCallback(async () => {
    if (!user || endpoints.length === 0) return;
    setBursting(true);
    // Fire across the first few endpoints for variety
    const targets = endpoints.slice(0, 3);
    for (const ep of targets) {
      setBurstId(ep.id);
      try {
        await fetch(`${PROXY_BASE}/fire`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ endpoint_id: ep.id, method: Math.random() > 0.5 ? 'GET' : 'POST', burst: 2 }),
        });
      } catch { /* ignore */ }
    }
    setBurstId(null);
    setBursting(false);
    onLogsChanged();
  }, [user, endpoints, onLogsChanged]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Live Request Feed</h3>
          <span className="text-xs text-slate-500">{logs.length} entries</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={simulateBurst}
            disabled={bursting || endpoints.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-40 border border-amber-500/40 text-amber-300 px-3 py-1.5 text-xs font-medium transition"
          >
            {bursting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Simulate Burst (5)
          </button>
          <button
            onClick={clearLogs}
            disabled={clearing || logs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-rose-500/20 disabled:opacity-40 border border-slate-700 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 px-3 py-1.5 text-xs font-medium transition"
          >
            {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Clear Logs
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-6 py-12 text-center">
          <Inbox className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No traffic logged yet. Fire a test request or simulate a burst.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Timestamp</th>
                  <th className="text-left font-medium px-4 py-3">Endpoint</th>
                  <th className="text-left font-medium px-4 py-3">Method</th>
                  <th className="text-left font-medium px-4 py-3">Injected Fault</th>
                  <th className="text-right font-medium px-4 py-3">Latency</th>
                  <th className="text-center font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">{fmtTime(log.timestamp)}</td>
                    <td className="px-4 py-3 text-slate-200 truncate max-w-[180px]">{epName(log.endpoint_id)}</td>
                    <td className="px-4 py-3"><span className="font-mono text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded px-1.5 py-0.5">{log.request_method}</span></td>
                    <td className="px-4 py-3"><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${faultBadgeClass(log.injected_fault_type)}`}>{faultShortLabel(log.injected_fault_type)}</span></td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-300">{log.actual_latency_ms}ms</td>
                    <td className="px-4 py-3 text-center"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusBadgeClass(log.client_status)}`}>{statusLabel(log.client_status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2.5">
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400 font-mono">{fmtTime(log.timestamp)}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBadgeClass(log.client_status)}`}>{statusLabel(log.client_status)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded px-1.5 py-0.5">{log.request_method}</span>
                  <span className="text-xs text-slate-200 truncate">{epName(log.endpoint_id)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${faultBadgeClass(log.injected_fault_type)}`}>{faultShortLabel(log.injected_fault_type)}</span>
                  <span className="font-mono text-xs text-slate-300">{log.actual_latency_ms}ms</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
