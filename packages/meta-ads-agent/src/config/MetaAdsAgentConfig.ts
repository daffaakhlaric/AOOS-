import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { z } from "zod";

import { DecisionError } from "../domain/errors/index.js";

/** Per the spec's Configuration section. */
export interface MetaAdsAgentConfig {
  readonly tenantId: string;
  readonly agentName: "Tamara";
  readonly language: "id";

  readonly maxAutoScaleBudgetIDR: number; // default: 500000
  readonly maxAutoReallocationIDR: number; // default: 2000000
  readonly highSpendThresholdIDR: number; // default: 1000000

  readonly autoExecutePauseRphMultiple: number; // default: 2.5
  readonly escalateRphMultiple: number; // default: 1.8

  readonly cycleIntervalHours: number; // default: 24
  readonly digestTimeHour: number; // default: 7
}

export const MetaAdsAgentConfigSchema = z.object({
  tenantId: z.string().min(1, "tenantId must not be empty"),
  agentName: z.literal("Tamara").default("Tamara"),
  language: z.literal("id").default("id"),
  maxAutoScaleBudgetIDR: z.number().int().positive().default(500_000),
  maxAutoReallocationIDR: z.number().int().positive().default(2_000_000),
  highSpendThresholdIDR: z.number().int().positive().default(1_000_000),
  autoExecutePauseRphMultiple: z.number().positive().default(2.5),
  escalateRphMultiple: z.number().positive().default(1.8),
  cycleIntervalHours: z.number().int().positive().default(24),
  digestTimeHour: z.number().int().min(0).max(23).default(7),
});

export type MetaAdsAgentConfigInput = z.input<typeof MetaAdsAgentConfigSchema>;

/** Validates a raw config object, failing fast with `Result.err(DecisionError)` rather than throwing. */
export function parseMetaAdsAgentConfig(input: unknown): Result<MetaAdsAgentConfig, DecisionError> {
  const parsed = MetaAdsAgentConfigSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return err(
      new DecisionError(`MetaAdsAgentConfig validation failed: ${details}`, {
        cause: new ValidationError(details),
      }),
    );
  }
  if (parsed.data.escalateRphMultiple >= parsed.data.autoExecutePauseRphMultiple) {
    return err(
      new DecisionError(
        `MetaAdsAgentConfig.escalateRphMultiple (${parsed.data.escalateRphMultiple}) must be less than autoExecutePauseRphMultiple (${parsed.data.autoExecutePauseRphMultiple})`,
      ),
    );
  }
  return ok(parsed.data);
}

/** The spec's exact stated defaults, usable directly by tests/fixtures without going through Zod parsing. */
export const DEFAULT_META_ADS_AGENT_CONFIG: Omit<MetaAdsAgentConfig, "tenantId"> = {
  agentName: "Tamara",
  language: "id",
  maxAutoScaleBudgetIDR: 500_000,
  maxAutoReallocationIDR: 2_000_000,
  highSpendThresholdIDR: 1_000_000,
  autoExecutePauseRphMultiple: 2.5,
  escalateRphMultiple: 1.8,
  cycleIntervalHours: 24,
  digestTimeHour: 7,
};
