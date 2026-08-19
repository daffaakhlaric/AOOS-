import type { AaosApiConfig } from "../config/aaos-api.config.js";

/**
 * Shared test-only fixtures/builders, used by both co-located unit tests (`src/**\/*.spec.ts`)
 * and `test/**\/*.spec.ts` e2e suites. Lives under `src/test-support/` (excluded from this app's
 * own coverage thresholds in `vitest.config.ts`) purely so every spec file — regardless of its
 * nesting depth under `src/` — can import it via a short, uniform relative path.
 */
export function buildTestConfig(overrides: Partial<AaosApiConfig> = {}): AaosApiConfig {
  return {
    PORT: 3000,
    NODE_ENV: "test",
    API_KEY: "test-api-key",
    META_API_VERSION: "v21.0",
    META_ACCESS_TOKEN: "test-access-token",
    META_AD_ACCOUNT_IDS: ["act_752604553578354"],
    META_WEBHOOK_VERIFY_TOKEN: "test-verify-token",
    META_WEBHOOK_APP_SECRET: "test-app-secret",
    AAOS_TENANT_ID: "dss-motor",
    WHATSAPP_ACCESS_TOKEN: "test-whatsapp-access-token",
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: "test-whatsapp-verify-token",
    WHATSAPP_WEBHOOK_APP_SECRET: "test-whatsapp-app-secret",
    WABA_ID_BINTARO: "waba-bintaro-1",
    PHONE_NUMBER_ID_BINTARO: "100000000000001",
    PHONE_NUMBER_BINTARO: "+628110000001",
    WABA_ID_CINERE: "waba-cinere-1",
    PHONE_NUMBER_ID_CINERE: "100000000000002",
    PHONE_NUMBER_CINERE: "+628110000002",
    WABA_ID_PONDOK_BAMBU: "waba-pondok-bambu-1",
    PHONE_NUMBER_ID_PONDOK_BAMBU: "100000000000003",
    PHONE_NUMBER_PONDOK_BAMBU: "+628110000003",
    WABA_ID_BANDUNG: "waba-bandung-1",
    PHONE_NUMBER_ID_BANDUNG: "100000000000004",
    PHONE_NUMBER_BANDUNG: "+628110000004",
    SUPABASE_URL: "https://test-project.supabase.co",
    SUPABASE_ANON_KEY: "test-supabase-anon-key",
    SUPABASE_SERVICE_KEY: "test-supabase-service-key",
    // Empty by default — most tests exercise the "no OpenAI key configured" fallback path;
    // llm module tests that need a configured key pass `{ OPENAI_API_KEY: "test-openai-key" }`.
    OPENAI_API_KEY: "",
    // Empty by default — most tests exercise the "aaos-simulator unavailable" fallback path;
    // simulation module tests that need it reachable pass
    // `{ AAOS_SIMULATOR_BASE_URL: "http://localhost:4100" }`.
    AAOS_SIMULATOR_BASE_URL: "",
    // AAOS-SCRAPER-ASSET-LIBRARY — empty by default so most tests exercise the "GCS/asset library
    // not configured" path. Tests needing a composed asset library pass `GCS_PROJECT_ID` +
    // `GCS_CREDENTIALS`.
    GCS_BUCKET_NAME: "aoos",
    GCS_PROJECT_ID: "",
    GCS_CREDENTIALS: "",
    GCS_KEY_FILE_PATH: "",
    MOBIX_LISTING_URL: "https://mobixbydss.id/unit",
    // AAOS-CREATIVE-REVIEW — empty by default so no test can ever compose a runtime capable of
    // making a real, billable Kie AI call. Tests that need the "Kai configured" branch pass
    // `KIE_AI_API_KEY` explicitly (and still only reach the composition code, never the network).
    KIE_AI_API_KEY: "",
    // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY — empty by default so most tests exercise the
    // "no redirectTo" impersonation path. Tests needing a specific redirect target pass this
    // explicitly.
    AAOS_DASHBOARD_BASE_URL: "",
    ...overrides,
  };
}

export function buildTestEnv(
  overrides: Partial<Record<string, string>> = {},
): Record<string, string | undefined> {
  return {
    PORT: "3000",
    NODE_ENV: "test",
    API_KEY: "test-api-key",
    META_API_VERSION: "v21.0",
    META_ACCESS_TOKEN: "test-access-token",
    META_AD_ACCOUNT_IDS: "act_752604553578354,act_999999999999999",
    META_WEBHOOK_VERIFY_TOKEN: "test-verify-token",
    META_WEBHOOK_APP_SECRET: "test-app-secret",
    AAOS_TENANT_ID: "dss-motor",
    WHATSAPP_ACCESS_TOKEN: "test-whatsapp-access-token",
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: "test-whatsapp-verify-token",
    WHATSAPP_WEBHOOK_APP_SECRET: "test-whatsapp-app-secret",
    WABA_ID_BINTARO: "waba-bintaro-1",
    PHONE_NUMBER_ID_BINTARO: "100000000000001",
    PHONE_NUMBER_BINTARO: "+628110000001",
    WABA_ID_CINERE: "waba-cinere-1",
    PHONE_NUMBER_ID_CINERE: "100000000000002",
    PHONE_NUMBER_CINERE: "+628110000002",
    WABA_ID_PONDOK_BAMBU: "waba-pondok-bambu-1",
    PHONE_NUMBER_ID_PONDOK_BAMBU: "100000000000003",
    PHONE_NUMBER_PONDOK_BAMBU: "+628110000003",
    WABA_ID_BANDUNG: "waba-bandung-1",
    PHONE_NUMBER_ID_BANDUNG: "100000000000004",
    PHONE_NUMBER_BANDUNG: "+628110000004",
    SUPABASE_URL: "https://test-project.supabase.co",
    SUPABASE_ANON_KEY: "test-supabase-anon-key",
    SUPABASE_SERVICE_KEY: "test-supabase-service-key",
    ...overrides,
  };
}
