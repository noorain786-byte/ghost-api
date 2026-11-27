import { useState } from 'react';
import type { RequestLog, ChaosEndpoint } from '@/lib/supabase';
import { CopyButton } from '@/components/CopyButton';
import { Brain, Loader2, ShieldCheck, AlertTriangle, Gauge, TrendingUp, Clock, Zap } from 'lucide-react';

interface Props {
  logs: RequestLog[];
  endpoints: ChaosEndpoint[];
}

interface AuditReport {
  resilienceScore: number;
  totalRequests: number;
  failureRate: number;
  avgLatency: number;
  maxLatency: number;
  timeouts: number;
  errors500: number;
  errors503: number;
  vulnerabilities: { title: string; severity: 'critical' | 'high' | 'medium' | 'low'; detail: string }[];
  recommendations: string[];
  codeSnippet: string;
  worstEndpoint?: ChaosEndpoint;
}

export default function AiPostMortem({ logs, endpoints }: Props) {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [running, setRunning] = useState(false);

  function runAudit() {
    setRunning(true);
    // Simulate async AI analysis
    setTimeout(() => {
      setReport(buildReport(logs, endpoints));
      setRunning(false);
    }, 900);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">AI Resilience Audit</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Analyzes your recent request logs and generates a Senior SRE diagnostic report with a copyable resilience wrapper.
            </p>
          </div>
        </div>
        <button
          onClick={runAudit}
          disabled={running || logs.length === 0}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-semibold px-5 py-2.5 text-sm transition shadow-lg shadow-cyan-500/20"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {running ? 'Analyzing traffic…' : 'Run AI Resilience Audit'}
        </button>
        {logs.length === 0 && <p className="text-xs text-amber-400/80 mt-2">No logs to analyze yet — fire some test requests first.</p>}
      </div>

      {report && <ReportView report={report} />}
    </div>
  );
}

function buildReport(logs: RequestLog[], endpoints: ChaosEndpoint[]): AuditReport {
  const total = logs.length;
  const failures = logs.filter((l) => l.has_chaos_error);
  const failureRate = total ? Math.round((failures.length / total) * 100) : 0;
  const avgLatency = total ? Math.round(logs.reduce((s, l) => s + l.actual_latency_ms, 0) / total) : 0;
  const maxLatency = total ? Math.max(...logs.map((l) => l.actual_latency_ms)) : 0;
  const timeouts = logs.filter((l) => l.injected_fault_type === 'timeout').length;
  const errors500 = logs.filter((l) => l.client_status === 500).length;
  const errors503 = logs.filter((l) => l.client_status === 503).length;

  // Score: start at 100, penalize
  let score = 100;
  score -= failureRate * 0.4;
  score -= Math.min(30, (avgLatency / 1000) * 6);
  score -= Math.min(20, (timeouts / Math.max(1, total)) * 100 * 0.2);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const vulnerabilities: AuditReport['vulnerabilities'] = [];
  if (timeouts > 0) vulnerabilities.push({ title: 'Cascading Timeouts', severity: 'critical', detail: `${timeouts} request(s) hit the 5000ms timeout ceiling with no AbortController cutoff downstream. A slow upstream can thread-pool-starve your service.` });
  if (errors503 > 0) vulnerabilities.push({ title: 'Unhandled 503 Errors', severity: 'high', detail: `${errors503} request(s) returned 503. No retry-with-jitter strategy detected for transient service-unavailable responses.` });
  if (errors500 > 0) vulnerabilities.push({ title: 'Unhandled 500 Errors', severity: 'high', detail: `${errors500} request(s) returned 500. Crashes propagate to callers with no circuit breaker.` });
  if (failureRate > 40) vulnerabilities.push({ title: 'Missing Exponential Backoff', severity: 'high', detail: `Failure rate is ${failureRate}%. Without exponential backoff, retries amplify load during outages.` });
  if (avgLatency > 1500) vulnerabilities.push({ title: 'Latency Tail Risk', severity: 'medium', detail: `Average latency is ${avgLatency}ms. The p99 tail is likely far worse and may breach SLOs.` });
  if (vulnerabilities.length === 0) vulnerabilities.push({ title: 'No Critical Issues Detected', severity: 'low', detail: 'Your traffic looks healthy. Keep monitoring for regressions.' });

  const recommendations: string[] = [];
  if (timeouts > 0) recommendations.push('Wrap all upstream calls in AbortController with a per-request timeout budget (e.g. 3000ms).');
  if (errors503 > 0 || errors500 > 0) recommendations.push('Add exponential backoff with full jitter: delay = random(0, base * 2^attempt).');
  if (failureRate > 40) recommendations.push('Introduce a circuit breaker that opens after N consecutive failures and half-opens after a cooldown.');
  recommendations.push('Add a request-level deadline that propagates through your call chain.');
  if (recommendations.length === 0) recommendations.push('Maintain your current retry policy and add alerting on p99 latency.');

  // Worst endpoint (most chaos errors)
  const errorCounts = new Map<string, number>();
  for (const l of failures) if (l.endpoint_id) errorCounts.set(l.endpoint_id, (errorCounts.get(l.endpoint_id) ?? 0) + 1);
  let worstEndpoint: ChaosEndpoint | undefined;
  let worstCount = 0;
  for (const [eid, c] of errorCounts) if (c > worstCount) { worstCount = c; worstEndpoint = endpoints.find((e) => e.id === eid); }
  if (!worstEndpoint && endpoints.length > 0) worstEndpoint = endpoints[0];

  const codeSnippet = generateSnippet(worstEndpoint);

  return { resilienceScore: score, totalRequests: total, failureRate, avgLatency, maxLatency, timeouts, errors500, errors503, vulnerabilities, recommendations, codeSnippet, worstEndpoint };
}

function generateSnippet(ep?: ChaosEndpoint): string {
  const target = ep?.target_url ?? 'https://api.example.com/resource';
  const timeoutMs = ep?.fault_type === 'timeout' ? 3000 : 4000;
  const maxRetries = 4;
  return `/**
 * Resilient fetch wrapper — AbortController timeout + exponential backoff with full jitter.
 * Generated by Ghost API for ${ep ? `endpoint "${ep.name}"` : 'your failing endpoint'}.
 */
async function resilientFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = ${timeoutMs},
  maxRetries = ${maxRetries},
): Promise<Response> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
      });

      clearTimeout(timer);

      // Retry on 5xx (transient server errors)
      if (res.status >= 500 && res.status < 600 && attempt < maxRetries) {
        await backoff(attempt);
        attempt++;
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err as Error;
      // Retry on abort (timeout) or network error
      if (attempt < maxRetries) {
        await backoff(attempt);
        attempt++;
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error('exhausted retries');
}

// Full-jitter exponential backoff: delay = random(0, base * 2^attempt)
function backoff(attempt: number, baseMs = 200): Promise<void> {
  const ceiling = baseMs * Math.pow(2, attempt);
  const delay = Math.random() * ceiling;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// Usage
// const res = await resilientFetch('${target}');
// const data = await res.json();`;
}

function ReportView({ report }: { report: AuditReport }) {
  const scoreColor = report.resilienceScore >= 75 ? 'text-emerald-400' : report.resilienceScore >= 50 ? 'text-amber-400' : 'text-rose-400';
  const scoreRing = report.resilienceScore >= 75 ? 'stroke-emerald-400' : report.resilienceScore >= 50 ? 'stroke-amber-400' : 'stroke-rose-400';

  return (
    <div className="space-y-4">
      {/* Score + metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 flex items-center gap-5">
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" strokeWidth="6" className="stroke-slate-800" />
              <circle cx="40" cy="40" r="34" fill="none" strokeWidth="6" strokeLinecap="round" className={scoreRing} strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - report.resilienceScore / 100)} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xl font-bold ${scoreColor}`}>{report.resilienceScore}</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-slate-400" />
              <h4 className="text-sm font-semibold text-white">Resilience Score</h4>
            </div>
            <p className="text-xs text-slate-400 mt-1">{report.resilienceScore >= 75 ? 'Healthy' : report.resilienceScore >= 50 ? 'At risk' : 'Critical'} — based on {report.totalRequests} requests</p>
          </div>
        </div>

        <MetricCard icon={<TrendingUp className="w-4 h-4 text-amber-400" />} label="Failure Rate" value={`${report.failureRate}%`} sub={`${report.errors500 + report.errors503 + report.timeouts} faults injected`} />
        <MetricCard icon={<Clock className="w-4 h-4 text-cyan-400" />} label="Avg / Max Latency" value={`${report.avgLatency}ms`} sub={`max ${report.maxLatency}ms · ${report.timeouts} timeouts`} />
      </div>

      {/* Vulnerabilities */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h4 className="text-sm font-semibold text-white">Detected Vulnerabilities</h4>
        </div>
        <div className="divide-y divide-slate-800/60">
          {report.vulnerabilities.map((v, i) => (
            <div key={i} className="px-5 py-3.5 flex items-start gap-3">
              <span className={`mt-0.5 text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${sevClass(v.severity)}`}>{v.severity}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-100">{v.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{v.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h4 className="text-sm font-semibold text-white">SRE Recommendations</h4>
        </div>
        <ul className="space-y-2">
          {report.recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
              <span className="text-cyan-400 font-mono text-xs mt-0.5">{i + 1}.</span>
              {r}
            </li>
          ))}
        </ul>
      </div>

      {/* Code snippet */}
      <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-semibold text-white">Resilient Fetch Wrapper</h4>
          </div>
          <CopyButton text={report.codeSnippet} label="Copy Code" />
        </div>
        <pre className="px-5 py-4 overflow-x-auto text-[12px] leading-relaxed text-slate-300 font-mono whitespace-pre"><code>{report.codeSnippet}</code></pre>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

function sevClass(s: string): string {
  switch (s) {
    case 'critical': return 'bg-rose-500/15 text-rose-300 border-rose-500/40';
    case 'high': return 'bg-orange-500/15 text-orange-300 border-orange-500/40';
    case 'medium': return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
    default: return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
  }
}
