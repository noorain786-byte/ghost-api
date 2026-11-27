# Project memory

## Product intent & audience

- **Ghost API** — synthetic chaos engineering proxy platform for developers.
- Users create chaos proxy rules targeting upstream APIs, inject faults (latency, 500, 503, timeout), monitor live traffic, and receive AI-generated SRE resilience reports with copyable fetch-wrapper remediation code.
- Audience: developers/SREs testing API resilience; includes instant Demo Login for testing.

## Brand personality & voice

- Developer-tool aesthetic; technical, precise, status-oriented language.
- Labels favor terse badges ("Chaos Engine Online", "200 OK", "CHAOS INJECTED").

## Visual design & UX direction

- Dark-mode developer theme: slate/zinc backgrounds, cyan + amber status accents, high contrast.
- Header shows app title "Ghost API" + pulsing "Chaos Engine Online" status badge.
- Layout: top header + metrics bar; bottom tab bar on mobile (375px), top tabs on desktop; no horizontal overflow.
- Desktop tables degrade to stacked cards on mobile for log feeds.
- Components: toggle switches, sliders (0–5000ms latency, 0–100% failure rate), fault-type dropdowns, copy buttons, color-coded status badges (green pass / red chaos).
- Live metrics bar: registered developers, chaos endpoints created, synthetic faults simulated (refreshed every 5s).
- Icons via lucide-react.

## Decisions, constraints & rationale

- Stack: React + TypeScript + Tailwind CSS + built-in Supabase (auth + DB + edge functions).
- Auth: email/password + Demo Login button; auto-trigger creates `users` profile row with generated `api_key` on signup.
- Three tables with RLS scoping rows to owner: `users`, `chaos_endpoints`, `request_logs`.
- `chaos_endpoints.fault_type` ∈ `'latency' | 'http_500' | 'http_503' | 'timeout'`; `failure_rate` 0–100.
- Proxy implemented as a Supabase edge function performing real outbound requests with chaos injection and logging every call; proxy URL supports query-parameter forwarding.
- AI Post-Mortem runs client-side analysis of `request_logs` to produce resilience score (0–100), vulnerability list, and a tailored TypeScript `fetch` wrapper with `AbortController` timeouts + full-jitter exponential backoff.
- Component export style was mixed (default vs named) and caused a build error — keep export/import styles consistent going forward.
- Do not install extra UI/icon packages beyond what the template provides (lucide-react).

## Open questions & assumptions

- Edge function URL base for "Copy Proxy URL" assumed from deployed Supabase function endpoint.
- AI resilience audit is heuristic/client-side, not calling an external LLM.
- Metrics counts rely on RLS-permitted aggregate reads; may need service-role if RLS restricts cross-user counts.