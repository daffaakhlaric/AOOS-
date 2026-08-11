import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import { DecisionType } from "../value-objects/DecisionType.js";
import type { ExecutionPlanId } from "../value-objects/ExecutionPlanId.js";

import type { CampaignDecision } from "./CampaignDecision.js";

export interface ExecutionPlanProps {
  readonly id: ExecutionPlanId;
  readonly tenantId: string;
  readonly decisions: ReadonlyArray<CampaignDecision>;
  readonly generatedAt: Date;
}

/** The ordered set of every `CampaignDecision` produced by one `RunOptimizationCycle`. */
export class ExecutionPlan {
  private constructor(private readonly props: ExecutionPlanProps) {}

  static create(props: ExecutionPlanProps): Result<ExecutionPlan, ValidationError> {
    if (typeof props.tenantId !== "string" || props.tenantId.trim().length === 0) {
      return err(new ValidationError("ExecutionPlan.tenantId must be a non-empty string"));
    }
    return ok(new ExecutionPlan({ ...props, decisions: [...props.decisions] }));
  }

  get id(): ExecutionPlanId {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get decisions(): ReadonlyArray<CampaignDecision> {
    return this.props.decisions;
  }

  get generatedAt(): Date {
    return this.props.generatedAt;
  }

  decisionsByType(type: DecisionType): ReadonlyArray<CampaignDecision> {
    return this.props.decisions.filter((d) => d.decisionType === type);
  }

  autoExecuted(): ReadonlyArray<CampaignDecision> {
    return this.decisionsByType(DecisionType.AUTO_EXECUTE);
  }

  escalated(): ReadonlyArray<CampaignDecision> {
    return this.decisionsByType(DecisionType.ESCALATE);
  }

  briefedToKai(): ReadonlyArray<CampaignDecision> {
    return this.decisionsByType(DecisionType.BRIEF_KAI);
  }

  noAction(): ReadonlyArray<CampaignDecision> {
    return this.decisionsByType(DecisionType.NO_ACTION);
  }
}
