import { type Result } from "@aos/common";
import { parseConfig } from "@aos/config";
import type { ValidationError } from "@aos/errors";
import { z } from "zod";

/**
 * Per the spec's Configuration section (`docs/PROMPT-AAOS-W1B-AAOS-API.md`). `META_AD_ACCOUNT_IDS`
 * is documented there as a `string` (the raw env var is comma-separated, e.g. `"act_xxx,act_yyy"`)
 * but this module's own "Domain design guidance" explicitly asks for it to become an array after
 * parsing — so the *parsed* `AaosApiConfig` exposes `META_AD_ACCOUNT_IDS` as
 * `ReadonlyArray<string>`, not the raw string, since every consumer downstream (the
 * `MetaAdsConnectorConfig` translation in particular) needs the array form. The raw env var itself
 * is still a plain comma-separated string, matching `.env.example`.
 */
export interface AaosApiConfig {
  readonly PORT: number;
  readonly NODE_ENV: "development" | "production" | "test";
  readonly API_KEY: string;
  readonly META_API_VERSION: string;
  readonly META_ACCESS_TOKEN: string;
  readonly META_AD_ACCOUNT_IDS: ReadonlyArray<string>;
  readonly META_WEBHOOK_VERIFY_TOKEN: string;
  readonly META_WEBHOOK_APP_SECRET: string;
  readonly AAOS_TENANT_ID: string;

  // --- WhatsApp Cloud API (AAOS-W2A @aos/whatsapp-connector) ---
  readonly WHATSAPP_ACCESS_TOKEN: string;
  readonly WHATSAPP_WEBHOOK_VERIFY_TOKEN: string;
  readonly WHATSAPP_WEBHOOK_APP_SECRET: string;
  readonly WABA_ID_BINTARO: string;
  readonly PHONE_NUMBER_ID_BINTARO: string;
  readonly PHONE_NUMBER_BINTARO: string;
  readonly WABA_ID_CINERE: string;
  readonly PHONE_NUMBER_ID_CINERE: string;
  readonly PHONE_NUMBER_CINERE: string;
  // Judgment call (mirrors @aos/whatsapp-connector's own resolution — see that package's README
  // "Branch.PONDOK_BAMBU resolution"): these three env vars are named exactly as the spec lists
  // them, but `to-whatsapp-connector-config.ts` maps this WABA's `branch` field to `Branch.UMUM`,
  // since the real `Branch` enum has no `PONDOK_BAMBU` member.
  readonly WABA_ID_PONDOK_BAMBU: string;
  readonly PHONE_NUMBER_ID_PONDOK_BAMBU: string;
  readonly PHONE_NUMBER_PONDOK_BAMBU: string;
  readonly WABA_ID_BANDUNG: string;
  readonly PHONE_NUMBER_ID_BANDUNG: string;
  readonly PHONE_NUMBER_BANDUNG: string;

  // --- Supabase (AAOS-W2E @aos/lead-store) ---
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_KEY: string;
}

export const AaosApiConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_KEY: z.string().min(1, "API_KEY must not be empty"),
  META_API_VERSION: z.string().min(1, "META_API_VERSION must not be empty"),
  META_ACCESS_TOKEN: z.string().min(1, "META_ACCESS_TOKEN must not be empty"),
  META_AD_ACCOUNT_IDS: z
    .string()
    .min(1, "META_AD_ACCOUNT_IDS must not be empty")
    .transform((raw) =>
      raw
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    )
    .refine((ids) => ids.length > 0, "META_AD_ACCOUNT_IDS must contain at least one ad account id"),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1, "META_WEBHOOK_VERIFY_TOKEN must not be empty"),
  META_WEBHOOK_APP_SECRET: z.string().min(1, "META_WEBHOOK_APP_SECRET must not be empty"),
  AAOS_TENANT_ID: z.string().min(1, "AAOS_TENANT_ID must not be empty"),

  WHATSAPP_ACCESS_TOKEN: z.string().min(1, "WHATSAPP_ACCESS_TOKEN must not be empty"),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z
    .string()
    .min(1, "WHATSAPP_WEBHOOK_VERIFY_TOKEN must not be empty"),
  WHATSAPP_WEBHOOK_APP_SECRET: z.string().min(1, "WHATSAPP_WEBHOOK_APP_SECRET must not be empty"),
  WABA_ID_BINTARO: z.string().min(1, "WABA_ID_BINTARO must not be empty"),
  PHONE_NUMBER_ID_BINTARO: z.string().min(1, "PHONE_NUMBER_ID_BINTARO must not be empty"),
  PHONE_NUMBER_BINTARO: z.string().min(1, "PHONE_NUMBER_BINTARO must not be empty"),
  WABA_ID_CINERE: z.string().min(1, "WABA_ID_CINERE must not be empty"),
  PHONE_NUMBER_ID_CINERE: z.string().min(1, "PHONE_NUMBER_ID_CINERE must not be empty"),
  PHONE_NUMBER_CINERE: z.string().min(1, "PHONE_NUMBER_CINERE must not be empty"),
  WABA_ID_PONDOK_BAMBU: z.string().min(1, "WABA_ID_PONDOK_BAMBU must not be empty"),
  PHONE_NUMBER_ID_PONDOK_BAMBU: z.string().min(1, "PHONE_NUMBER_ID_PONDOK_BAMBU must not be empty"),
  PHONE_NUMBER_PONDOK_BAMBU: z.string().min(1, "PHONE_NUMBER_PONDOK_BAMBU must not be empty"),
  WABA_ID_BANDUNG: z.string().min(1, "WABA_ID_BANDUNG must not be empty"),
  PHONE_NUMBER_ID_BANDUNG: z.string().min(1, "PHONE_NUMBER_ID_BANDUNG must not be empty"),
  PHONE_NUMBER_BANDUNG: z.string().min(1, "PHONE_NUMBER_BANDUNG must not be empty"),

  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY must not be empty"),
  SUPABASE_SERVICE_KEY: z.string().min(1, "SUPABASE_SERVICE_KEY must not be empty"),
});

/**
 * Validates `process.env` (or an injected source, primarily for tests) against
 * `AaosApiConfigSchema`, per `@aos/config`'s `Result`-returning discipline (never throw for an
 * expected/recoverable failure). The *caller* — `main.ts`, one of the few places in the whole
 * AAOS stack where crashing at process-boundary startup is correct per this task's guidance —
 * decides to fail fast and exit the process on an `err` result.
 */
export function parseAaosApiConfig(
  source: Record<string, string | undefined> = process.env,
): Result<AaosApiConfig, ValidationError> {
  return parseConfig(AaosApiConfigSchema, source);
}
