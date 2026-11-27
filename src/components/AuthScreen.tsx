import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Ghost, Zap, Activity, ShieldCheck } from 'lucide-react';

export default function AuthScreen() {
  const { signIn, signUp, signInDemo } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fn = mode === 'signin' ? signIn : signUp;
    const { error } = await fn(email, password);
    setBusy(false);
    if (error) setError(error);
  }

  async function handleDemo() {
    setError(null);
    setBusy(true);
    const { error } = await signInDemo();
    setBusy(false);
    if (error) setError(error);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Decorative top bar */}
      <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-amber-400" />

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left brand panel */}
        <div className="lg:flex-1 flex flex-col justify-center px-6 py-10 lg:px-16 lg:py-20 border-b lg:border-b-0 lg:border-r border-slate-800/60 bg-slate-950 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #22d3ee 0, transparent 40%), radial-gradient(circle at 80% 70%, #fbbf24 0, transparent 40%)' }} />
          <div className="relative max-w-md mx-auto lg:mx-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Ghost className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Ghost API</h1>
                <p className="text-xs text-cyan-400 font-medium tracking-wide uppercase">Chaos Engineering Proxy</p>
              </div>
            </div>
            <p className="text-slate-300 leading-relaxed mb-8 text-sm lg:text-base">
              Inject synthetic latency, 500s, 503s, and timeouts into any API endpoint — then watch your requests crumble in real time and get an AI-written resilience report.
            </p>
            <div className="space-y-3">
              <FeatureRow icon={<Zap className="w-4 h-4 text-amber-400" />} text="Spin up chaos proxy rules in seconds" />
              <FeatureRow icon={<Activity className="w-4 h-4 text-cyan-400" />} text="Live traffic monitor with fault injection logs" />
              <FeatureRow icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />} text="AI SRE post-mortem with copyable retry code" />
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="lg:flex-1 flex items-center justify-center px-6 py-10 lg:px-16">
          <div className="w-full max-w-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white">
                {mode === 'signin' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {mode === 'signin' ? 'Sign in to your chaos console.' : 'Start breaking your APIs on purpose.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/60 focus:border-cyan-500 transition"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/60 focus:border-cyan-500 transition"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-sm text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold py-2.5 text-sm transition shadow-lg shadow-cyan-500/20"
              >
                {busy ? 'Working…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
              <div className="relative flex justify-center"><span className="bg-slate-950 px-3 text-xs text-slate-500 uppercase tracking-wide">or</span></div>
            </div>

            <button
              onClick={handleDemo}
              disabled={busy}
              className="w-full rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-100 font-medium py-2.5 text-sm transition flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              Demo Login
            </button>

            <p className="text-center text-sm text-slate-400 mt-6">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
                className="text-cyan-400 hover:text-cyan-300 font-medium transition"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-300">
      <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">{icon}</div>
      {text}
    </div>
  );
}
