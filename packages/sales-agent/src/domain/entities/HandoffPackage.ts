import type { InventoryUnit } from "@aos/dss-inventory-connector";

import type { BranchId } from "../value-objects/BranchId.js";
import type { LeadScore } from "../value-objects/LeadScore.js";
import type { QualificationStatus } from "../value-objects/QualificationStatus.js";

export interface HandoffExtractedInfo {
  readonly budget?: string;
  readonly unit?: string;
  readonly area?: string;
  readonly paymentMethod?: string;
  readonly timeline?: string;
  readonly name?: string;
}

export interface HandoffPackageProps {
  readonly leadPhone: string;
  readonly branchId: BranchId;
  readonly conversationSummary: string;
  readonly score: LeadScore;
  readonly qualifiedCriteria: ReadonlyArray<QualificationStatus>;
  readonly extractedInfo: HandoffExtractedInfo;
  readonly recommendedAction: string;
  readonly matchedUnits: ReadonlyArray<InventoryUnit>;
  readonly conversationHighlights: ReadonlyArray<string>;
}

/**
 * What Clara prepares for the sales human when a lead becomes HOT (spec "Handoff Package") —
 * built by `HandoffPackageBuilder`, consumed by `HandoffService` to call `@aos/branch-manager`'s
 * `AssignLead` and to prepare the handoff `OutgoingMessage`. Immutable, plain read model (no
 * behavior beyond field access — every derivation happens in the builder).
 */
export class HandoffPackage {
  private constructor(private readonly props: HandoffPackageProps) {}

  static create(props: HandoffPackageProps): HandoffPackage {
    return new HandoffPackage({
      ...props,
      qualifiedCriteria: [...props.qualifiedCriteria],
      matchedUnits: [...props.matchedUnits],
      conversationHighlights: [...props.conversationHighlights],
    });
  }

  get leadPhone(): string {
    return this.props.leadPhone;
  }

  get branchId(): BranchId {
    return this.props.branchId;
  }

  get conversationSummary(): string {
    return this.props.conversationSummary;
  }

  get score(): LeadScore {
    return this.props.score;
  }

  get qualifiedCriteria(): ReadonlyArray<QualificationStatus> {
    return this.props.qualifiedCriteria;
  }

  get extractedInfo(): HandoffExtractedInfo {
    return this.props.extractedInfo;
  }

  get recommendedAction(): string {
    return this.props.recommendedAction;
  }

  get matchedUnits(): ReadonlyArray<InventoryUnit> {
    return this.props.matchedUnits;
  }

  get conversationHighlights(): ReadonlyArray<string> {
    return this.props.conversationHighlights;
  }
}
