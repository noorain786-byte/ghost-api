import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { supabase, type ChaosEndpoint, type FaultType, FAULT_LABELS, PROXY_BASE } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CopyButton } from '@/components/CopyButton';
import { faultBadgeClass, faultShortLabel, faultFullLabel, randomSlug, timeAgo } from '@/lib/helpers';
import { Plus, Zap, Loader2, Pause, Play, ExternalLink, Flame, Trash2 } from 'lucide-react';

const FAULT_OPTIONS: FaultType[] = ['latency', 'http_500', 'http_503', 'timeout'];

interface Props {
  endpoints: ChaosEndpoint[];
  onEndpointsChanged: () => void;
  onLogsChanged: () => void;
}

export default function RuleBuilder({ endpoints, onEndpointsChanged, onLogsChanged }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('Payment Gateway Staging');
  const [targetUrl, setTargetUrl] = useState('https://jsonplaceholder.typicode.com/posts/1');
  const [faultType, setFaultType] = useState<FaultType>('latency');
  const [latencyMs, setLatencyMs] = useState(2000);
  const [failureRate, setFailureRate] = useState(80);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firingId, setFiringId] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSubmitting(true);
    const slug = randomSlug();
    const { error: insErr } = await supabase.from('chaos_endpoints').insert({
      user_id: user.id,
      name: name.trim() || 'Untitled Endpoint',
      target_url: targetUrl.trim(),
      proxy_slug: slug,
      fault_type: faultType,
      latency_ms: latencyMs,
      error_code: faultType === 'http_503' ? 503 : 500,
      failure_rate: failureRate,
      is_active: true,
    });
    setSubmitting(false);
    if (insErr) { setError(insErr.message); return; }
    onEndpointsChanged();
  }

  async function toggleActive(ep: ChaosEndpoint) {
    const { error } = await supabase.from('chaos_endpoints').update({ is_active: !ep.is_active }).eq('id', ep.id);
    if (error) return;
    onEndpointsChanged();
  }

  async function deleteEndpoint(ep: ChaosEndpoint) {
    const { error } = await supabase.from('chaos_endpoints').delete().eq('id', ep.id);
    if (error) return;
    onEndpointsChanged();
    onLogsChanged();
  }

  const fireTest = useCallback(async (ep: ChaosEndpoint) => {
    setFiringId(ep.id);
    try {
      const res = await fetch(`${PROXY_BASE}/fire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ endpoint_id: ep.id, method: 'GET' }),
      });
      if (!res.ok) setError(`Fire request failed (${res.status})`);
    } catch (e) {
      setError(String(e));
    } finally {
      setFiringId(null);
      onLogsChanged();
    }
  }, [onLogsChanged]);

  return (
    <div className="space-y-6">
      {/* Form card */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
            <Plus className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Create Chaos Rule</h3>
            <p className="text-xs text-slate-400">Configure a synthetic fault injection proxy.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Endpoint Name">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Payment Gateway Staging" />
            </Field>
            <Field label="Target API URL">
              <input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} className={inputCls} placeholder="https://jsonplaceholder.typicode.com/posts/1" />
            </Field>
          </div>

          <Field label="Fault Type">
            <select value={faultType} onChange={(e) => setFaultType(e.target.value as FaultType)} className={inputCls}>
              {FAULT_OPTIONS.map((f) => <option key={f} value={f}>{faultFullLabel(f)}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={`Latency Delay — ${latencyMs}ms`}>
              <input type="range" min={0} max={5000} step={100} value={latencyMs} onChange={(e) => setLatencyMs(Number(e.target.value))} className="w-full accent-cyan-500" />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1"><span>0ms</span><span>5000ms</span></div>
            </Field>
            <Field label={`Failure Probability — ${failureRate}%`}>
              <input type="range" min={0} max={100} step={1} value={failureRate} onChange={(e) => setFailureRate(Number(e.target.value))} className="w-full accent-amber-500" />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1"><span>0%</span><span>100%</span></div>
            </Field>
          </div>

          {error && <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-sm text-rose-300">{error}</div>}

          <button type="submit" disabled={submitting} className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold px-5 py-2.5 text-sm transition shadow-lg shadow-cyan-500/20">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {submitting ? 'Creating…' : 'Deploy Chaos Rule'}
          </button>
        </form>
      </div>

      {/* Endpoint cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Active Endpoints</h3>
          <span className="text-xs text-slate-500">{endpoints.length} total</span>
        </div>

        {endpoints.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-6 py-10 text-center">
            <p className="text-sm text-slate-400">No chaos endpoints yet. Create your first rule above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {endpoints.map((ep) => (
              <EndpointCard
                key={ep.id}
                ep={ep}
                onToggle={() => toggleActive(ep)}
                onDelete={() => deleteEndpoint(ep)}
                onFire={() => fireTest(ep)}
                firing={firingId === ep.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EndpointCard({ ep, onToggle, onDelete, onFire, firing }: { ep: ChaosEndpoint; onToggle: () => void; onDelete: () => void; onFire: () => void; firing: boolean }) {
  const proxyUrl = `${PROXY_BASE}/${ep.proxy_slug}`;
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden transition hover:border-slate-700">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-white truncate">{ep.name}</h4>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${faultBadgeClass(ep.fault_type)}`}>
                {faultShortLabel(ep.fault_type)}
              </span>
              {ep.fault_type === 'latency' && <span className="text-[10px] text-amber-400 font-mono">+{ep.latency_ms}ms</span>}
              <span className="text-[10px] text-slate-500 font-mono">{ep.failure_rate}% fail</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate font-mono" title={ep.target_url}>{ep.target_url}</p>
          </div>

          {/* Toggle */}
          <button
            onClick={onToggle}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border transition ${ep.is_active ? 'bg-cyan-500/80 border-cyan-400' : 'bg-slate-800 border-slate-700'}`}
            title={ep.is_active ? 'Active' : 'Paused'}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform mt-0.5 ${ep.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border ${ep.is_active ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
            {ep.is_active ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            {ep.is_active ? 'Active' : 'Paused'}
          </span>

          <div className="flex-1 min-w-[180px] flex items-center gap-2 rounded-md bg-slate-950 border border-slate-800 px-2.5 py-1.5">
            <code className="text-[11px] text-cyan-300 font-mono truncate flex-1">{proxyUrl}</code>
            <CopyButton text={proxyUrl} label="Copy" />
          </div>

          <button onClick={() => window.open(proxyUrl, '_blank')} className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 py-1.5 text-xs font-medium transition">
            <ExternalLink className="w-3.5 h-3.5" /> Open
          </button>

          <button onClick={onFire} disabled={firing} className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-50 border border-amber-500/40 text-amber-300 px-2.5 py-1.5 text-xs font-medium transition">
            {firing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flame className="w-3.5 h-3.5" />}
            Fire Test
          </button>

          <button onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-rose-500/20 hover:border-rose-500/40 border border-slate-700 text-slate-400 hover:text-rose-300 px-2.5 py-1.5 text-xs font-medium transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-2">Created {timeAgo(ep.created_at)} · slug: {ep.proxy_slug}</p>
      </div>
    </div>
  );
}

const inputCls = 'w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
