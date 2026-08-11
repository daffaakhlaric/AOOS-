/**
 * Judgment call (documented in the engineering report, resolution #1): re-export the real
 * `Branch` enum from the already-shipped, independently-verified `@aos/meta-ads-connector`
 * package rather than redefining it — per the standing monorepo rule not to modify a shipped
 * package, and per the spec's own instruction ("Branch.ts ← import from @aos/meta-ads-connector").
 * The real enum is `CINERE | BINTARO | BANDUNG | BOOST | MULTI | UMUM` — it has no
 * `PONDOK_BAMBU` member. Every place this package's spec says `Branch.PONDOK_BAMBU` (the
 * `WabaAccount` domain comment, the `WABA_ACCOUNTS` config example, `.env.example`'s
 * `WABA_ID_PONDOK_BAMBU` block) is mapped to `Branch.UMUM` when constructing the actual `Branch`
 * value — see `config/WhatsAppConnectorConfig.ts` and `registry/WabaRegistry.ts` for where that
 * mapping is applied. The env var NAMES themselves (`WABA_ID_PONDOK_BAMBU`,
 * `PHONE_NUMBER_ID_PONDOK_BAMBU`, `PHONE_NUMBER_PONDOK_BAMBU`) are kept exactly as the spec
 * lists them — they are config keys, not enum values.
 */
export { Branch } from "@aos/meta-ads-connector";
