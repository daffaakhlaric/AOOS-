import { ErrorCode, err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { z } from "zod";

import { CreativeConnectorError } from "../domain/errors/CreativeConnectorError.js";

/** Per the spec's Configuration section. */
export interface CreativeConnectorConfig {
  readonly apiKey: string;
  readonly generationBaseUrl: "https://api.kie.ai";
  readonly uploadBaseUrl: "https://kieai.redpandaai.co";
  readonly defaultVideoModel: "veo3" | "veo3_fast";
  readonly defaultImageModel: "nano-banana-pro";
  readonly defaultAspectRatio: "16:9" | "9:16" | "1:1";
  readonly callbackUrl?: string;
  readonly pollIntervalMs: number;
  readonly maxPollDurationMs: number;
  readonly rateLimitPerTenSeconds: number;
  readonly tenantId: string;
}

/**
 * Judgment call (mirroring `@aos/meta-ads-connector`'s `MetaAdsConnectorConfig` docstring):
 * `@aos/config`'s `parseConfig` is shaped for parsing raw `process.env`-style string records,
 * which doesn't fit this config's already-typed numeric/literal fields. This schema instead
 * applies the same `Result`-returning discipline (Zod `safeParse`, never throw) directly to an
 * arbitrary input object.
 */
export const CreativeConnectorConfigSchema = z.object({
  apiKey: z.string().min(1, "apiKey must not be empty"),
  generationBaseUrl: z.literal("https://api.kie.ai").default("https://api.kie.ai"),
  uploadBaseUrl: z.literal("https://kieai.redpandaai.co").default("https://kieai.redpandaai.co"),
  defaultVideoModel: z.enum(["veo3", "veo3_fast"]).default("veo3_fast"),
  // REAL BUG FIX (confirmed live against api.kie.ai, 2026-08-18): "google/nano-banana-pro" is
  // rejected by the real API (422 "model name ... not supported"); the real, working model string
  // is "nano-banana-pro" with no prefix.
  defaultImageModel: z.literal("nano-banana-pro").default("nano-banana-pro"),
  defaultAspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  callbackUrl: z.string().url().optional(),
  pollIntervalMs: z.number().int().positive().default(5000),
  maxPollDurationMs: z.number().int().positive().default(300000),
  rateLimitPerTenSeconds: z.number().int().positive().default(20),
  tenantId: z.string().min(1, "tenantId must not be empty"),
});

export type CreativeConnectorConfigInput = z.input<typeof CreativeConnectorConfigSchema>;

/** Validates a raw config object, failing fast with `Result.err(CreativeConnectorError)` rather than throwing. */
export function parseCreativeConnectorConfig(
  input: unknown,
): Result<CreativeConnectorConfig, CreativeConnectorError> {
  const parsed = CreativeConnectorConfigSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return err(
      new CreativeConnectorError(
        ErrorCode.VALIDATION_ERROR,
        `CreativeConnectorConfig validation failed: ${details}`,
        { cause: new ValidationError(details) },
      ),
    );
  }
  return ok(parsed.data);
}
