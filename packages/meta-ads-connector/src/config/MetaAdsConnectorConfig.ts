import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { z } from "zod";

import { ConnectorConfigError } from "../domain/errors/index.js";

/** Per the spec's Configuration section. */
export interface MetaAdsConnectorConfig {
  readonly apiVersion: "v21.0";
  readonly baseUrl: "https://graph.facebook.com";
  readonly accessToken: string;
  readonly adAccountIds: ReadonlyArray<string>;
  readonly webhookVerifyToken: string;
  readonly webhookAppSecret: string;
  readonly rateLimitPerHour: number;
  readonly retryMaxAttempts: number;
  readonly retryBaseDelayMs: number;
  readonly timeoutMs: number;
  readonly tenantId: string;
}

const AD_ACCOUNT_ID_PATTERN = /^act_\d+$/;

/**
 * Judgment call: `@aos/config`'s `parseConfig` is specifically shaped for parsing raw
 * `process.env`-style `Record<string, string | undefined>` sources (see
 * `packages/config/src/typed-config.ts`), which doesn't fit `MetaAdsConnectorConfig` — it needs
 * an array field (`adAccountIds`) and numeric fields callers naturally supply as already-typed
 * JS values (e.g. from a composed config object, not flat env strings). This schema instead uses
 * the same `Result`-returning discipline `parseConfig` establishes (Zod `safeParse`, never
 * throw), applied directly to an arbitrary input object rather than an env record.
 */
export const MetaAdsConnectorConfigSchema = z.object({
  apiVersion: z.literal("v21.0"),
  baseUrl: z.literal("https://graph.facebook.com"),
  accessToken: z.string().min(1, "accessToken must not be empty"),
  adAccountIds: z
    .array(z.string().regex(AD_ACCOUNT_ID_PATTERN, 'each adAccountId must match "act_<digits>"'))
    .min(1, "adAccountIds must contain at least one ad account"),
  webhookVerifyToken: z.string().min(1, "webhookVerifyToken must not be empty"),
  webhookAppSecret: z.string().min(1, "webhookAppSecret must not be empty"),
  rateLimitPerHour: z.number().int().positive().default(200),
  retryMaxAttempts: z.number().int().positive().default(3),
  retryBaseDelayMs: z.number().int().positive().default(1000),
  timeoutMs: z.number().int().positive().default(30000),
  tenantId: z.string().min(1, "tenantId must not be empty"),
});

export type MetaAdsConnectorConfigInput = z.input<typeof MetaAdsConnectorConfigSchema>;

/** Validates a raw config object, failing fast with `Result.err(ConnectorConfigError)` rather than throwing. */
export function parseMetaAdsConnectorConfig(
  input: unknown,
): Result<MetaAdsConnectorConfig, ConnectorConfigError> {
  const parsed = MetaAdsConnectorConfigSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return err(
      new ConnectorConfigError(`MetaAdsConnectorConfig validation failed: ${details}`, {
        cause: new ValidationError(details),
      }),
    );
  }
  return ok(parsed.data);
}
