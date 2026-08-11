import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { z } from "zod";

import { InvalidObjectiveError } from "../domain/errors/index.js";

/** Per the spec's Configuration section. */
export interface ObjectiveEngineConfig {
  readonly tenantId: string;
  readonly hotLeadConversionRate: number; // default: 0.18 (18%)
  readonly budgetBufferFactor: number; // default: 1.15 (15%)
  readonly onTrackThreshold: number; // default: 0.85
  readonly atRiskThreshold: number; // default: 0.60
  readonly maxObjectivesPerMonth: number; // default: 1
}

/**
 * Judgment call, matching `@aos/meta-ads-connector`'s `MetaAdsConnectorConfigSchema` precedent:
 * `@aos/config`'s `parseConfig` is shaped for flat `process.env`-style string records, which
 * doesn't fit this config's numeric-with-defaults fields naturally supplied as already-typed JS
 * values — this schema instead applies the same `Result`-returning Zod discipline directly to an
 * arbitrary input object.
 */
export const ObjectiveEngineConfigSchema = z.object({
  tenantId: z.string().min(1, "tenantId must not be empty"),
  hotLeadConversionRate: z.number().positive().max(1).default(0.18),
  budgetBufferFactor: z.number().min(1).default(1.15),
  onTrackThreshold: z.number().min(0).max(1).default(0.85),
  atRiskThreshold: z.number().min(0).max(1).default(0.6),
  maxObjectivesPerMonth: z.number().int().positive().default(1),
});

export type ObjectiveEngineConfigInput = z.input<typeof ObjectiveEngineConfigSchema>;

/** Validates a raw config object, failing fast with `Result.err(InvalidObjectiveError)` rather than throwing. */
export function parseObjectiveEngineConfig(
  input: unknown,
): Result<ObjectiveEngineConfig, InvalidObjectiveError> {
  const parsed = ObjectiveEngineConfigSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return err(
      new InvalidObjectiveError(`ObjectiveEngineConfig validation failed: ${details}`, {
        cause: new ValidationError(details),
      }),
    );
  }
  if (parsed.data.atRiskThreshold > parsed.data.onTrackThreshold) {
    return err(
      new InvalidObjectiveError(
        `ObjectiveEngineConfig.atRiskThreshold (${parsed.data.atRiskThreshold}) must not exceed onTrackThreshold (${parsed.data.onTrackThreshold})`,
      ),
    );
  }
  return ok(parsed.data);
}

/** The spec's exact stated defaults, usable directly by tests/fixtures without going through Zod parsing. */
export const DEFAULT_OBJECTIVE_ENGINE_CONFIG: Omit<ObjectiveEngineConfig, "tenantId"> = {
  hotLeadConversionRate: 0.18,
  budgetBufferFactor: 1.15,
  onTrackThreshold: 0.85,
  atRiskThreshold: 0.6,
  maxObjectivesPerMonth: 1,
};
