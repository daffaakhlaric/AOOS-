import type { BranchId } from "../value-objects/BranchId.js";
import type { LeadScore } from "../value-objects/LeadScore.js";
import type { QualificationStatus } from "../value-objects/QualificationStatus.js";

import type { HandoffExtractedInfo } from "./HandoffPackage.js";
import type { PropertyListing } from "./PropertyListing.js";

export interface PropertyHandoffPackageProps {
  readonly leadPhone: string;
  readonly branchId: BranchId;
  readonly conversationSummary: string;
  readonly score: LeadScore;
  readonly qualifiedCriteria: ReadonlyArray<QualificationStatus>;
  readonly extractedInfo: HandoffExtractedInfo;
  readonly recommendedAction: string;
  readonly matchedListings: ReadonlyArray<PropertyListing>;
  readonly conversationHighlights: ReadonlyArray<string>;
}

/**
 * PROPERTY-vertical sibling to `HandoffPackage` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8,
 * spec section 12 point 2) — what Jessy prepares for the sales human when a PROPERTY lead becomes
 * HOT. Same immutable, plain read-model shape as `HandoffPackage`; the only real difference is
 * `matchedListings: ReadonlyArray<PropertyListing>` in place of `matchedUnits:
 * ReadonlyArray<InventoryUnit>` — confirmed via direct read that `HandoffPackage`/
 * `HandoffPackageBuilder` are concretely `InventoryUnit`-typed end to end (not vertical-generic
 * despite the coordinator note's initial assumption), so this is a real, additive sibling rather
 * than a retrofit.
 */
export class PropertyHandoffPackage {
  private constructor(private readonly props: PropertyHandoffPackageProps) {}

  static create(props: PropertyHandoffPackageProps): PropertyHandoffPackage {
    return new PropertyHandoffPackage({
      ...props,
      qualifiedCriteria: [...props.qualifiedCriteria],
      matchedListings: [...props.matchedListings],
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

  get matchedListings(): ReadonlyArray<PropertyListing> {
    return this.props.matchedListings;
  }

  get conversationHighlights(): ReadonlyArray<string> {
    return this.props.conversationHighlights;
  }
}
