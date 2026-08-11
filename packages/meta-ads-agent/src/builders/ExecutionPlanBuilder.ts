import { err, ok, type Result } from "@aos/common";

import type { CampaignDecision } from "../domain/entities/CampaignDecision.js";
import { ExecutionPlan } from "../domain/entities/ExecutionPlan.js";
import { DecisionError } from "../domain/errors/index.js";
import { ExecutionPlanId } from "../domain/value-objects/ExecutionPlanId.js";

/** Builds an `ExecutionPlan` from an ordered list of `CampaignDecision`s produced this cycle. */
export class ExecutionPlanBuilder {
  static build(
    tenantId: string,
    decisions: ReadonlyArray<CampaignDecision>,
    generatedAt: Date,
  ): Result<ExecutionPlan, DecisionError> {
    const planResult = ExecutionPlan.create({
      id: ExecutionPlanId.generate(),
      tenantId,
      decisions,
      generatedAt,
    });
    if (!planResult.ok) {
      return err(new DecisionError(planResult.error.message));
    }
    return ok(planResult.value);
  }
}
