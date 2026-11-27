import { useCallback, useEffect, useState } from 'react';
import { supabase, type ChaosEndpoint, type RequestLog } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import RuleBuilder from '@/components/RuleBuilder';
import LiveTraffic from '@/components/LiveTraffic';
import AiPostMortem from '@/components/AiPostMortem';
import { CopyButton } from '@/components/CopyButton';
import { Ghost, Users, Network, FlaskConical, LogOut, Hammer, Radio, Brain, Wifi } from 'lucide-react';

type Tab = 'builder' | 'monitor' | 'audit';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'builder', label: 'Rule Builder', icon: <Hammer className="w-4 h-4" /> },
  { id: 'monitor', label: 'Live Traffic', icon: <Radio className="w-4 h-4" /> },
  { id: 'audit', label: 'AI Post-Mortem', icon: <Brain className="w-4 h-4" /> },
];

export default function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('builder');
  const [endpoints, setEndpoints] = useState<ChaosEndpoint[]>([]);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [devCount, setDevCount] = useState(0);
  const [endpointCount, setEndpointCount] = useState(0);
  const [logCount, setLogCount] = useState(0);

  const loadEndpoints = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('chaos_endpoints').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setEndpoints((data as ChaosEndpoint[]) ?? []);
  }, [user]);

  const loadLogs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('request_logs').select('*').eq('user_id', user.id).order('timestamp', { ascending: false }).limit(200);
    setLogs((data as RequestLog[]) ?? []);
  }, [user]);

  const loadMetrics = useCallback(async () => {
    const { count: dc } = await supabase.from('users').select('*', { count: 'exact', head: true });
    setDevCount(dc ?? 0);
    if (user) {
      const { count: ec } = await supabase.from('chaos_endpoints').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      setEndpointCount(ec ?? 0);
      const { count: lc } = await supabase.from('request_logs').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      setLogCount(lc ?? 0);
    }
  }, [user]);

  useEffect(() => {
    loadEndpoints();
    loadLogs();
    loadMetrics();
  }, [loadEndpoints, loadLogs, loadMetrics]);

  // Poll logs every 5s for "live" feel
  useEffect(() => {
    const id = setInterval(() => { loadLogs(); loadMetrics(); }, 5000);
    return () => clearInterval(id);
  }, [loadLogs, loadMetrics]);

  function refreshAll() {
    loadEndpoints();
    loadLogs();
    loadMetrics();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/20">
                <Ghost className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-white leading-tight truncate">Ghost API</h1>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Chaos Engine Online
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {profile && (
                <div className="hidden sm:flex items-center gap-1.5 rounded-md bg-slate-900 border border-slate-800 px-2.5 py-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">API Key</span>
                  <code className="text-[11px] text-cyan-300 font-mono">{profile.api_key.slice(0, 8)}…</code>
                  <CopyButton text={profile.api_key} label="" className="!px-1.5 !py-0.5" />
                </div>
              )}
              <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-2.5 py-1.5 text-xs font-medium transition">
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Metrics bar */}
      <div className="border-b border-slate-800 bg-slate-900/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <Metric icon={<Users className="w-4 h-4 text-cyan-400" />} label="Developers" value={devCount} />
            <Metric icon={<Network className="w-4 h-4 text-amber-400" />} label="Chaos Endpoints" value={endpointCount} />
            <Metric icon={<FlaskConical className="w-4 h-4 text-fuchsia-400" />} label="Faults Simulated" value={logCount} />
          </div>
        </div>
      </div>

      {/* Desktop tabs */}
      <div className="hidden md:block border-b border-slate-800 bg-slate-950">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${tab === t.id ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-8">
        {tab === 'builder' && <RuleBuilder endpoints={endpoints} onEndpointsChanged={refreshAll} onLogsChanged={refreshAll} />}
        {tab === 'monitor' && <LiveTraffic logs={logs} endpoints={endpoints} onLogsChanged={refreshAll} />}
        {tab === 'audit' && <AiPostMortem logs={logs} endpoints={endpoints} />}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-950/95 backdrop-blur border-t border-slate-800">
        <div className="grid grid-cols-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 transition ${tab === t.id ? 'text-cyan-300' : 'text-slate-500'}`}
            >
              {t.icon}
              <span className="text-[10px] font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2.5 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-md bg-slate-950 border border-slate-800 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide truncate">{label}</p>
        <p className="text-base sm:text-lg font-bold text-white leading-tight">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}
