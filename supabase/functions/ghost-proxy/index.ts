import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ChaosEndpointRow {
  id: string;
  user_id: string;
  name: string;
  target_url: string;
  proxy_slug: string;
  fault_type: 'latency' | 'http_500' | 'http_503' | 'timeout';
  latency_ms: number;
  error_code: number;
  failure_rate: number;
  is_active: boolean;
}

function randomSlug() {
  return 'g' + Math.random().toString(36).slice(2, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/ghost-proxy/, '').replace(/^\//, '');
    const slug = path.split('/')[0] || url.searchParams.get('slug') || '';

    // Route: POST /fire — simulate a test request for an endpoint without making
    // a real outbound call. Used by the "Fire Test Request" and "Simulate Burst" buttons.
    if (slug === 'fire' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const endpointId: string | undefined = body.endpoint_id;
      const method: string = body.method || 'GET';
      const burst: number = Number(body.burst) || 1;

      if (!endpointId) {
        return new Response(JSON.stringify({ error: 'endpoint_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: ep, error: epErr } = await supabase
        .from('chaos_endpoints')
        .select('*')
        .eq('id', endpointId)
        .maybeSingle<ChaosEndpointRow>();

      if (epErr || !ep) {
        return new Response(JSON.stringify({ error: 'endpoint not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const logs: any[] = [];
      for (let i = 0; i < Math.min(burst, 25); i++) {
        const inject = ep.is_active && Math.random() * 100 < ep.failure_rate;
        let injected = 'none';
        let latency = 0;
        let status = 200;
        let hasChaos = false;

        if (inject) {
          hasChaos = true;
          injected = ep.fault_type;
          if (ep.fault_type === 'latency') {
            latency = ep.latency_ms + Math.floor(Math.random() * 250);
            status = 200;
          } else if (ep.fault_type === 'http_500') {
            latency = 30 + Math.floor(Math.random() * 80);
            status = 500;
          } else if (ep.fault_type === 'http_503') {
            latency = 20 + Math.floor(Math.random() * 60);
            status = 503;
          } else if (ep.fault_type === 'timeout') {
            latency = 5000 + Math.floor(Math.random() * 400);
            status = 0;
          }
        } else {
          latency = 40 + Math.floor(Math.random() * 180);
          status = 200;
        }

        logs.push({
          endpoint_id: ep.id,
          user_id: ep.user_id,
          request_method: method,
          injected_fault_type: injected,
          actual_latency_ms: latency,
          client_status: status,
          has_chaos_error: hasChaos,
        });
      }

      const { data: inserted, error: logErr } = await supabase
        .from('request_logs')
        .insert(logs)
        .select('*');

      if (logErr) {
        return new Response(JSON.stringify({ error: logErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({ logs: inserted, count: inserted?.length || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: /<proxy_slug> — live proxy with chaos injection
    const { data: ep, error } = await supabase
      .from('chaos_endpoints')
      .select('*')
      .eq('proxy_slug', slug)
      .maybeSingle<ChaosEndpointRow>();

    if (error || !ep) {
      return new Response(JSON.stringify({ error: 'unknown proxy slug' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const inject = ep.is_active && Math.random() * 100 < ep.failure_rate;
    const start = Date.now();
    let injected = 'none';
    let clientStatus = 200;
    let hasChaos = false;

    if (inject) {
      hasChaos = true;
      injected = ep.fault_type;
      if (ep.fault_type === 'latency') {
        await new Promise((r) => setTimeout(r, ep.latency_ms));
      } else if (ep.fault_type === 'http_500') {
        clientStatus = 500;
      } else if (ep.fault_type === 'http_503') {
        clientStatus = 503;
      } else if (ep.fault_type === 'timeout') {
        await new Promise((r) => setTimeout(r, 5000));
        clientStatus = 0;
      }
    }

    let upstreamBody: any = null;
    let upstreamStatus = 200;
    if (!inject || ep.fault_type === 'latency' || ep.fault_type === 'timeout') {
      try {
        const upstream = await fetch(ep.target_url, {
          method: req.method,
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5500),
        });
        upstreamStatus = upstream.status;
        upstreamBody = await upstream.text().catch(() => null);
        if (!inject) clientStatus = upstreamStatus;
      } catch (_e) {
        if (!inject) clientStatus = 0;
      }
    }

    const elapsed = Date.now() - start;

    // Log the request
    await supabase.from('request_logs').insert({
      endpoint_id: ep.id,
      user_id: ep.user_id,
      request_method: req.method,
      injected_fault_type: injected,
      actual_latency_ms: elapsed,
      client_status: clientStatus,
      has_chaos_error: hasChaos,
    });

    if (clientStatus !== 200 && clientStatus !== 0) {
      return new Response(
        JSON.stringify({ chaos: true, fault: injected, status: clientStatus }),
        { status: clientStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (clientStatus === 0) {
      return new Response(
        JSON.stringify({ chaos: true, fault: 'timeout', message: 'upstream timed out' }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const safeBody = upstreamBody == null ? JSON.stringify({ ok: true }) : upstreamBody;
    return new Response(safeBody, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});


