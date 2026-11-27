import { AuthProvider, useAuth } from '@/context/AuthContext';
import AuthScreen from '@/components/AuthScreen';
import Dashboard from '@/components/Dashboard';
import { Ghost } from 'lucide-react';

function Gate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center animate-pulse">
            <Ghost className="w-5 h-5 text-white" />
          </div>
          <p className="text-sm text-slate-400">Booting chaos engine…</p>
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
