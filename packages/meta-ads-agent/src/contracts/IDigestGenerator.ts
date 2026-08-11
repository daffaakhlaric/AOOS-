import type { Result } from "@aos/common";
import type { ObjectiveProgress } from "@aos/objective-engine";

import type { DailyDigest } from "../domain/entities/DailyDigest.js";
import type { ExecutionPlan } from "../domain/entities/ExecutionPlan.js";
import type { DecisionError } from "../domain/errors/index.js";

export interface DigestGenerationInput {
  readonly tenantId: string;
  readonly date: Date;
  readonly targetHotLeads: number;
  readonly budgetAllocationIDR: number;
  readonly progress: ObjectiveProgress;
  readonly plan: ExecutionPlan;
}

/** Port for generating the plain-Indonesian `DailyDigest` — implemented by `builders/DailyDigestBuilder.ts`. */
export interface IDigestGenerator {
  generate(input: DigestGenerationInput): Result<DailyDigest, DecisionError>;
}
