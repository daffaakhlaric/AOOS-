import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { z } from "zod";

import { ClosingTrackerError } from "../domain/errors/ClosingTrackerError.js";

/** Per the spec's "Configuration" section. */
export interface ClosingTrackerConfig {
  readonly tenantId: string;
  readonly rphSpkScaleThreshold: number; // default: 2_000_000
  readonly rphSpkKeepThreshold: number; // default: 5_000_000
  /**
   * **Coordinator note #2**: spec'd field, kept for schema fidelity, but deliberately NOT read by
   * `resolveVerdict` — see `domain/entities/CampaignAttribution.ts` and the package report for the
   * full resolution of the spec's threshold-count contradiction.
   */
  readonly rphSpkPauseThreshold: number; // default: 10_000_000
  /**
   * **Coordinator note #4**: campaigns/branches/units with fewer than this many SPK in the period
   * are excluded from attribution-confidence-bearing selection (`topCampaign`/`worstCampaign`) —
   * see `application/services/ReportGeneratorService.ts` and the package report.
   */
  readonly minSpkForAttribution: number; // default: 1
  readonly minSpendForPause: number; // default: 1_000_000
}

/**
 * Judgment call, matching `@aos/lead-store`'s `LeadStoreConfigSchema` / `@aos/objective-engine`'s
 * `ObjectiveEngineConfigSchema` precedent: `@aos/config`'s `parseConfig` is shaped for flat
 * `process.env`-style string records, which doesn't fit this config's typed/defaulted numeric
 * fields naturally supplied as already-typed JS values — this schema applies the same
 * `Result`-returning Zod discipline directly to an arbitrary input object instead.
 */
export const ClosingTrackerConfigSchema = z.object({
  tenantId: z.string().min(1, "tenantId must not be empty"),
  rphSpkScaleThreshold: z.number().positive().default(2_000_000),
  rphSpkKeepThreshold: z.number().positive().default(5_000_000),
  rphSpkPauseThreshold: z.number().positive().default(10_000_000),
  minSpkForAttribution: z.number().int().nonnegative().default(1),
  minSpendForPause: z.number().nonnegative().default(1_000_000),
});

export type ClosingTrackerConfigInput = z.input<typeof ClosingTrackerConfigSchema>;

/** Validates a raw config object, failing fast with `Result.err` rather than throwing. */
export function parseClosingTrackerConfig(
  input: unknown,
): Result<ClosingTrackerConfig, ClosingTrackerError> {
  const parsed = ClosingTrackerConfigSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return err(
      new ClosingTrackerError(`ClosingTrackerConfig validation failed: ${details}`, {
        cause: new ValidationError(details),
      }),
    );
  }
  if (parsed.data.rphSpkScaleThreshold >= parsed.data.rphSpkKeepThreshold) {
    return err(
      new ClosingTrackerError(
        `ClosingTrackerConfig.rphSpkScaleThreshold (${parsed.data.rphSpkScaleThreshold}) must be less than rphSpkKeepThreshold (${parsed.data.rphSpkKeepThreshold})`,
      ),
    );
  }
  if (parsed.data.rphSpkKeepThreshold >= parsed.data.rphSpkPauseThreshold) {
    return err(
      new ClosingTrackerError(
        `ClosingTrackerConfig.rphSpkKeepThreshold (${parsed.data.rphSpkKeepThreshold}) must be less than rphSpkPauseThreshold (${parsed.data.rphSpkPauseThreshold})`,
      ),
    );
  }
  return ok(parsed.data);
}

/** The spec's exact stated defaults, usable directly by tests/fixtures without going through Zod parsing. */
export const DEFAULT_CLOSING_TRACKER_CONFIG: Omit<ClosingTrackerConfig, "tenantId"> = {
  rphSpkScaleThreshold: 2_000_000,
  rphSpkKeepThreshold: 5_000_000,
  rphSpkPauseThreshold: 10_000_000,
  minSpkForAttribution: 1,
  minSpendForPause: 1_000_000,
};
