import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { Verdict } from "@aos/meta-ads-connector";

import type { DecisionActionKind, DecisionTargetType } from "../../types/AgentTypes.js";
import type { ConfidenceScore } from "../value-objects/ConfidenceScore.js";
import type { DecisionId } from "../value-objects/DecisionId.js";
import type { DecisionReason } from "../value-objects/DecisionReason.js";
import { DecisionType } from "../value-objects/DecisionType.js";
import type { ImpactEstimate } from "../value-objects/ImpactEstimate.js";

export interface CampaignDecisionProps {
  readonly id: DecisionId;
  readonly targetId: string;
  readonly targetType: DecisionTargetType;
  readonly actionKind: DecisionActionKind;
  readonly decisionType: DecisionType;
  readonly verdict?: Verdict;
  readonly reason: DecisionReason;
  readonly confidence: ConfidenceScore;
  readonly impact: ImpactEstimate;
  readonly budgetChangeIDR?: number;
  readonly spendIDR?: number;
  /** The adset's current daily budget in whole IDR — only set for SCALE decisions, required by `@aos/meta-ads-connector`'s `ExecuteVerdict`. */
  readonly currentDailyBudgetIDR?: number;
  readonly createdAt: Date;
}

/**
 * A single optimization decision — either per-ad (driven by `@aos/meta-ads-connector`'s
 * `Verdict`, produced by `VerdictDecisionEngine`) or portfolio-level (driven by
 * `BudgetOptimizer`'s reallocation/new-campaign findings) — unified under one entity per the
 * spec's DECIDE stage feeding a single `ExecutionPlan`.
 */
export class CampaignDecision {
  private constructor(private readonly props: CampaignDecisionProps) {}

  static create(props: CampaignDecisionProps): Result<CampaignDecision, ValidationError> {
    if (typeof props.targetId !== "string" || props.targetId.trim().length === 0) {
      return err(new ValidationError("CampaignDecision.targetId must be a non-empty string"));
    }
    if (!Object.values(DecisionType).includes(props.decisionType)) {
      return err(
        new ValidationError(
          `CampaignDecision.decisionType must be a valid DecisionType, received: ${String(props.decisionType)}`,
        ),
      );
    }
    if (
      props.budgetChangeIDR !== undefined &&
      (!Number.isFinite(props.budgetChangeIDR) || !Number.isInteger(props.budgetChangeIDR))
    ) {
      return err(
        new ValidationError(
          `CampaignDecision.budgetChangeIDR must be a whole-IDR integer when present, received: ${String(props.budgetChangeIDR)}`,
        ),
      );
    }
    if (props.spendIDR !== undefined && (!Number.isFinite(props.spendIDR) || props.spendIDR < 0)) {
      return err(
        new ValidationError(
          `CampaignDecision.spendIDR must be a non-negative finite number when present, received: ${String(props.spendIDR)}`,
        ),
      );
    }
    return ok(new CampaignDecision({ ...props }));
  }

  get id(): DecisionId {
    return this.props.id;
  }

  get targetId(): string {
    return this.props.targetId;
  }

  get targetType(): DecisionTargetType {
    return this.props.targetType;
  }

  get actionKind(): DecisionActionKind {
    return this.props.actionKind;
  }

  get decisionType(): DecisionType {
    return this.props.decisionType;
  }

  get verdict(): Verdict | undefined {
    return this.props.verdict;
  }

  get reason(): DecisionReason {
    return this.props.reason;
  }

  get confidence(): ConfidenceScore {
    return this.props.confidence;
  }

  get impact(): ImpactEstimate {
    return this.props.impact;
  }

  get budgetChangeIDR(): number | undefined {
    return this.props.budgetChangeIDR;
  }

  get spendIDR(): number | undefined {
    return this.props.spendIDR;
  }

  get currentDailyBudgetIDR(): number | undefined {
    return this.props.currentDailyBudgetIDR;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  isAutoExecutable(): boolean {
    return this.props.decisionType === DecisionType.AUTO_EXECUTE;
  }

  isEscalation(): boolean {
    return this.props.decisionType === DecisionType.ESCALATE;
  }

  isBriefKai(): boolean {
    return this.props.decisionType === DecisionType.BRIEF_KAI;
  }
}
