import type { Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import type { CampaignDecision } from "../domain/entities/CampaignDecision.js";
import { ExecutionPlan, type ExecutionPlanProps } from "../domain/entities/ExecutionPlan.js";
import { ExecutionPlanId } from "../domain/value-objects/ExecutionPlanId.js";

export interface ExecutionPlanFactoryInput {
  readonly id?: ExecutionPlanId;
  readonly tenantId: string;
  readonly decisions: ReadonlyArray<CampaignDecision>;
  readonly generatedAt: Date;
}

/**
 * Factory Pattern class turning raw input into a fully-validated `ExecutionPlan` — the low-level
 * entity factory (reconstruction/tests), distinct from `builders/ExecutionPlanBuilder.ts` which
 * is the higher-level collaborator `RunOptimizationCycle` calls (always generates a fresh id,
 * wraps validation failures as `DecisionError`). Mirrors `@aos/objective-engine`'s
 * `ObjectiveFactory` vs `ObjectiveBuilder` distinction.
 */
export class ExecutionPlanFactory {
  static create(input: ExecutionPlanFactoryInput): Result<ExecutionPlan, ValidationError> {
    const props: ExecutionPlanProps = {
      id: input.id ?? ExecutionPlanId.generate(),
      tenantId: input.tenantId,
      decisions: input.decisions,
      generatedAt: input.generatedAt,
    };
    return ExecutionPlan.create(props);
  }
}
