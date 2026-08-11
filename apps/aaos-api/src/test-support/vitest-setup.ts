/**
 * Global Vitest setup. `@supabase/supabase-js`'s `RealtimeClient` requires a native `WebSocket`
 * constructor at `createClient(...)` construction time (only available natively on Node 22+);
 * this monorepo currently targets Node 20, so a minimal stub is installed here, once, for every
 * test file in this app. No real connection is ever opened — constructing a `SupabaseClient`
 * (via `@aos/lead-store`'s `LeadStoreFactory`, wired into `AppModule.forRoot`) performs no
 * network I/O by itself; the stub only exists to satisfy the realtime client's constructor guard.
 */
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  (globalThis as { WebSocket?: unknown }).WebSocket = class FakeWebSocket {};
}
