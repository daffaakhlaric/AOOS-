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
