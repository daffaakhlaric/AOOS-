import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { Branch } from "@aos/meta-ads-connector";
import { z } from "zod";

import { ConnectorConfigError } from "../domain/errors/index.js";

/** Per the spec's Configuration section. */
export interface WhatsAppConnectorWabaAccountConfig {
  readonly wabaId: string;
  readonly phoneNumberId: string;
  readonly phoneNumber: string; // +62xxx
  readonly branch: Branch;
  readonly displayName: string;
}

export interface WhatsAppConnectorConfig {
  readonly apiVersion: "v21.0";
  readonly baseUrl: "https://graph.facebook.com";
  readonly accessToken: string;
  readonly webhookVerifyToken: string;
  readonly webhookAppSecret: string;
  readonly tenantId: string;
  readonly rateLimitPerSecond: number;
  readonly retryMaxAttempts: number;
  readonly retryBaseDelayMs: number;
  readonly timeoutMs: number;
  readonly wabaAccounts: ReadonlyArray<WhatsAppConnectorWabaAccountConfig>;
}

const BRANCH_VALUES = Object.values(Branch) as [Branch, ...Branch[]];

const WabaAccountConfigSchema = z.object({
  wabaId: z.string().min(1, "wabaId must not be empty"),
  phoneNumberId: z.string().min(1, "phoneNumberId must not be empty"),
  phoneNumber: z.string().regex(/^\+62\d{8,13}$/, "phoneNumber must be a +62 E.164 number"),
  branch: z.enum(BRANCH_VALUES),
  displayName: z.string().min(1, "displayName must not be empty"),
});

/**
 * Judgment call (see the engineering report's resolution #1): mirrors `@aos/meta-ads-connector`'s
 * `MetaAdsConnectorConfigSchema`'s approach of a `Result`-returning schema over an arbitrary
 * input object (not `@aos/config`'s `parseConfig`, which is shaped for flat env-string sources
 * and doesn't fit this config's nested `wabaAccounts` array). The fourth branch's config block is
 * built by *callers* (e.g. `apps/aaos-api`'s composition, or a test fixture) from the
 * `WABA_ID_PONDOK_BAMBU`/etc. env vars but must set `branch: Branch.UMUM`, since `Branch` has no
 * `PONDOK_BAMBU` member — this schema itself just validates that whatever `branch` value it's
 * given is one of the real `Branch` enum members, and rejects anything else (including a
 * hypothetical raw `"PONDOK_BAMBU"` string).
 */
export const WhatsAppConnectorConfigSchema = z.object({
  apiVersion: z.literal("v21.0"),
  baseUrl: z.literal("https://graph.facebook.com"),
  accessToken: z.string().min(1, "accessToken must not be empty"),
  webhookVerifyToken: z.string().min(1, "webhookVerifyToken must not be empty"),
  webhookAppSecret: z.string().min(1, "webhookAppSecret must not be empty"),
  tenantId: z.string().min(1, "tenantId must not be empty"),
  rateLimitPerSecond: z.number().int().positive().default(100),
  retryMaxAttempts: z.number().int().positive().default(3),
  retryBaseDelayMs: z.number().int().positive().default(1000),
  timeoutMs: z.number().int().positive().default(10000),
  wabaAccounts: z
    .array(WabaAccountConfigSchema)
    .min(1, "wabaAccounts must contain at least one WABA account"),
});

export type WhatsAppConnectorConfigInput = z.input<typeof WhatsAppConnectorConfigSchema>;

/** Validates a raw config object, failing fast with `Result.err(ConnectorConfigError)` rather than throwing. */
export function parseWhatsAppConnectorConfig(
  input: unknown,
): Result<WhatsAppConnectorConfig, ConnectorConfigError> {
  const parsed = WhatsAppConnectorConfigSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return err(
      new ConnectorConfigError(`WhatsAppConnectorConfig validation failed: ${details}`, {
        cause: new ValidationError(details),
      }),
    );
  }
  return ok(parsed.data);
}
