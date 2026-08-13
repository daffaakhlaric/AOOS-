import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { z } from "zod";

import { CapiError } from "../domain/errors/CapiError.js";

/** Per the spec's "Configuration" section. */
export interface CapiConnectorConfig {
  readonly pixelId: string;
  readonly accessToken: string;
  readonly apiVersion: "v21.0";
  readonly baseUrl: string;
  readonly testEventCode?: string;
  readonly eventSourceUrl: string;
  /** Default 1 = immediate send (MVP). */
  readonly batchSize: number;
  /** Default 0 = no windowed accumulation (MVP). */
  readonly flushIntervalMs: number;
  readonly retryMaxAttempts: number;
  readonly retryBaseDelayMs: number;
  readonly tenantId: string;
}

/**
 * Judgment call, matching `@aos/closing-tracker`'s `ClosingTrackerConfigSchema` precedent:
 * `@aos/config`'s `parseConfig` is shaped for flat `process.env`-style string records, which
 * doesn't fit this config's typed/defaulted fields naturally supplied as already-typed JS values
 * — this schema applies the same `Result`-returning Zod discipline directly to an arbitrary
 * input object instead.
 */
export const CapiConnectorConfigSchema = z.object({
  pixelId: z.string().min(1, "pixelId must not be empty"),
  accessToken: z.string().min(1, "accessToken must not be empty"),
  apiVersion: z.literal("v21.0").default("v21.0"),
  baseUrl: z.string().url().default("https://graph.facebook.com"),
  testEventCode: z.string().min(1).optional(),
  eventSourceUrl: z
    .string()
    .regex(/^https:\/\/.+/, "eventSourceUrl must be an https:// URL")
    .default("https://mobixbydss.id"),
  batchSize: z.number().int().positive().max(1000).default(1),
  flushIntervalMs: z.number().int().nonnegative().default(0),
  retryMaxAttempts: z.number().int().positive().default(3),
  retryBaseDelayMs: z.number().int().nonnegative().default(1000),
  tenantId: z.string().min(1, "tenantId must not be empty"),
});

export type CapiConnectorConfigInput = z.input<typeof CapiConnectorConfigSchema>;

/** Validates a raw config object, failing fast with `Result.err` rather than throwing. */
export function parseCapiConnectorConfig(input: unknown): Result<CapiConnectorConfig, CapiError> {
  const parsed = CapiConnectorConfigSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return err(
      new CapiError(`CapiConnectorConfig validation failed: ${details}`, {
        cause: new ValidationError(details),
      }),
    );
  }
  return ok(parsed.data);
}

/** The spec's exact stated defaults, usable directly by tests/fixtures without going through Zod parsing. */
export const DEFAULT_CAPI_CONNECTOR_CONFIG: Omit<
  CapiConnectorConfig,
  "pixelId" | "accessToken" | "tenantId"
> = {
  apiVersion: "v21.0",
  baseUrl: "https://graph.facebook.com",
  eventSourceUrl: "https://mobixbydss.id",
  batchSize: 1,
  flushIntervalMs: 0,
  retryMaxAttempts: 3,
  retryBaseDelayMs: 1000,
};
