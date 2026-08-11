import { err, ErrorCode, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { z } from "zod";

import { AgentError } from "../domain/errors/AgentError.js";

export interface SalesAgentConfig {
  readonly tenantId: string;
  readonly agentName: "Jessy";
  readonly language: "id";

  readonly hotThreshold: number;
  readonly warmThreshold: number;
  readonly noReplyTimeoutMs: number;

  readonly minResponseDelayMs: number;
  readonly maxResponseDelayMs: number;

  readonly followUpEnabled: boolean;
  readonly followUpDays: ReadonlyArray<number>;
}

/**
 * Judgment call (same class as `@aos/branch-manager`'s `BranchManagerConfigSchema` and
 * `@aos/dss-inventory-connector`'s `InventoryConnectorConfigSchema`): `@aos/config`'s
 * `parseConfig` targets flat `process.env`-style string records; this config's typed/defaulted
 * numeric + literal fields fit a plain Zod object schema over an arbitrary input better.
 */
export const SalesAgentConfigSchema = z.object({
  tenantId: z.string().min(1, "tenantId must not be empty"),
  agentName: z.literal("Jessy").default("Jessy"),
  language: z.literal("id").default("id"),
  hotThreshold: z.number().int().min(0).max(100).default(65),
  warmThreshold: z.number().int().min(0).max(100).default(31),
  noReplyTimeoutMs: z.number().int().positive().default(21_600_000),
  minResponseDelayMs: z.number().int().nonnegative().default(800),
  maxResponseDelayMs: z.number().int().nonnegative().default(3000),
  followUpEnabled: z.boolean().default(true),
  followUpDays: z.array(z.number().int().positive()).default([3, 7, 14]),
});

export type SalesAgentConfigInput = z.input<typeof SalesAgentConfigSchema>;

/** Validates a raw config object, failing fast with `Result.err` rather than throwing. */
export function parseSalesAgentConfig(input: unknown): Result<SalesAgentConfig, AgentError> {
  const parsed = SalesAgentConfigSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return err(
      new AgentError(ErrorCode.VALIDATION_ERROR, `SalesAgentConfig validation failed: ${details}`, {
        cause: new ValidationError(details),
      }),
    );
  }
  if (parsed.data.warmThreshold >= parsed.data.hotThreshold) {
    return err(
      new AgentError(
        ErrorCode.VALIDATION_ERROR,
        `SalesAgentConfig.warmThreshold (${parsed.data.warmThreshold}) must be less than hotThreshold (${parsed.data.hotThreshold})`,
      ),
    );
  }
  if (parsed.data.minResponseDelayMs > parsed.data.maxResponseDelayMs) {
    return err(
      new AgentError(
        ErrorCode.VALIDATION_ERROR,
        "SalesAgentConfig.minResponseDelayMs must not exceed maxResponseDelayMs",
      ),
    );
  }
  return ok(parsed.data);
}
