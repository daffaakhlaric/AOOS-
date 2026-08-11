import { err, ErrorCode, ok, type Result } from "@aos/common";
import { z } from "zod";

import { JudgeError } from "../domain/errors/JudgeError.js";

/** Per-dimension weights used to compute `OverallScore` (spec "Grading" weighted formula). Must sum to 1.0. */
export interface DimensionWeights {
  readonly naturalLanguage: number;
  readonly qualification: number;
  readonly objectionHandling: number;
  readonly closingAttempt: number;
  readonly handoffQuality: number;
  readonly responseLength: number;
}

/**
 * AI Judge configuration (spec's "Grading" weights + golden/approve thresholds). Every default
 * matches the spec's literal numbers exactly: weights 0.20/0.25/0.15/0.20/0.10/0.10 (sum 1.0),
 * approveThreshold=80, goldenThreshold=85.
 */
export interface AiJudgeConfig {
  readonly weights: DimensionWeights;
  readonly approveThreshold: number;
  readonly goldenThreshold: number;
  readonly tenantId: string;
}

const DimensionWeightsSchema = z.object({
  naturalLanguage: z.number().min(0).max(1).default(0.2),
  qualification: z.number().min(0).max(1).default(0.25),
  objectionHandling: z.number().min(0).max(1).default(0.15),
  closingAttempt: z.number().min(0).max(1).default(0.2),
  handoffQuality: z.number().min(0).max(1).default(0.1),
  responseLength: z.number().min(0).max(1).default(0.1),
});

export const AiJudgeConfigSchema = z.object({
  weights: DimensionWeightsSchema.default({}),
  approveThreshold: z.number().min(0).max(100).default(80),
  goldenThreshold: z.number().min(0).max(100).default(85),
  tenantId: z.string().min(1, "tenantId must not be empty").default("tenant-dss-motor"),
});

export type AiJudgeConfigInput = z.input<typeof AiJudgeConfigSchema>;

/** The fully-defaulted config `AiJudgeFactory` hands to every use case when the caller supplies no overrides. */
export const DEFAULT_AI_JUDGE_CONFIG: AiJudgeConfig = AiJudgeConfigSchema.parse({});

/** Parses + validates raw config input, returning `Result` (constitution: expected/recoverable failures are values, not exceptions). */
export function parseAiJudgeConfig(input: unknown): Result<AiJudgeConfig, JudgeError> {
  const parsed = AiJudgeConfigSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return err(
      new JudgeError(
        ErrorCode.VALIDATION_ERROR,
        parsed.error.issues.map((i) => i.message).join("; "),
      ),
    );
  }
  const weightSum = Object.values(parsed.data.weights).reduce((sum, w) => sum + w, 0);
  if (Math.abs(weightSum - 1) > 1e-9) {
    return err(
      new JudgeError(
        ErrorCode.VALIDATION_ERROR,
        `Dimension weights must sum to 1.0 (got ${weightSum})`,
      ),
    );
  }
  return ok(parsed.data);
}
