import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type FaultType = 'latency' | 'http_500' | 'http_503' | 'timeout';

export interface ChaosEndpoint {
  id: string;
  user_id: string;
  name: string;
  target_url: string;
  proxy_slug: string;
  fault_type: FaultType;
  latency_ms: number;
  error_code: number;
  failure_rate: number;
  is_active: boolean;
  created_at: string;
}

export interface RequestLog {
  id: string;
  endpoint_id: string | null;
  user_id: string;
  timestamp: string;
  request_method: string;
  injected_fault_type: string;
  actual_latency_ms: number;
  client_status: number;
  has_chaos_error: boolean;
}

export const FAULT_LABELS: Record<FaultType, string> = {
  latency: 'Latency Spike',
  http_500: 'HTTP 500 Internal Server Error',
  http_503: 'HTTP 503 Service Unavailable',
  timeout: 'Network Timeout (5000ms)',
};

export const PROXY_BASE = `${supabaseUrl}/functions/v1/ghost-proxy`;
