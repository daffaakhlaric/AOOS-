/**
 * Nest DI tokens for providers that are not classes (config value, event publisher instance,
 * the composed `@aos/meta-ads-connector` connector, and the raw `WebhookVerifier` used directly
 * by the GET handshake endpoint). Using distinct `Symbol`s (rather than string tokens) avoids any
 * accidental collision with a future provider that happens to share a string name.
 */
export const AAOS_API_CONFIG = Symbol("AAOS_API_CONFIG");
export const EVENT_PUBLISHER = Symbol("EVENT_PUBLISHER");
export const LEAD_STORE = Symbol("LEAD_STORE");
export const META_ADS_CONNECTOR = Symbol("META_ADS_CONNECTOR");
export const WEBHOOK_VERIFIER = Symbol("WEBHOOK_VERIFIER");
export const WHATSAPP_CONNECTOR = Symbol("WHATSAPP_CONNECTOR");
export const WHATSAPP_WEBHOOK_VERIFIER = Symbol("WHATSAPP_WEBHOOK_VERIFIER");
/** AAOS-W4A additions — see `app.module.ts`'s `forRoot` for how each is composed. */
export const OBJECTIVE_ENGINE = Symbol("OBJECTIVE_ENGINE");
export const BRANCH_MANAGER = Symbol("BRANCH_MANAGER");
/**
 * The new `creative-packages` module's process-local, in-memory "pending review" store (AAOS-W4A
 * coordinator note #3) — deliberately NOT part of `@aos/creative-agent` (whose own
 * `GenerationJobRegistry` is scoped to generation-job status only, not review/approval workflow
 * state) and NOT durable. See `modules/creative-packages/creative-package.store.ts`'s class doc.
 */
export const CREATIVE_PACKAGE_STORE = Symbol("CREATIVE_PACKAGE_STORE");
/**
 * AAOS-W4B additions — the raw `@aos/lead-store` `MessageRepository`/`ClosingRepository` infra
 * classes, composed in `app.module.ts` against the SAME Supabase client `LeadStoreFactory` uses
 * (shared, not a second connection). Needed because the composed `LeadStore` exposes no use case
 * for "list every message in a conversation" (lead-detail's real conversation history) or "list
 * raw closings matching a filter" (`GET /api/v1/closings`) — only `@aos/lead-store`'s aggregate
 * `GetClosingStats` and write-only `SaveMessage`. Both repository classes are genuinely exported
 * from `@aos/lead-store`'s public `index.ts`, so this composes only real, already-public symbols.
 */
export const LEAD_STORE_MESSAGE_REPOSITORY = Symbol("LEAD_STORE_MESSAGE_REPOSITORY");
export const LEAD_STORE_CLOSING_REPOSITORY = Symbol("LEAD_STORE_CLOSING_REPOSITORY");
