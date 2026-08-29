import type { BranchId, SalesHumanId } from "@aos/branch-manager";
import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { ClosingId } from "../value-objects/ClosingId.js";
import type { ClosingType } from "../value-objects/ClosingType.js";
import type { LeadId } from "../value-objects/LeadId.js";

export interface ClosingProps {
  readonly id: ClosingId;
  readonly leadId: LeadId;
  readonly salesHumanId: SalesHumanId;
  readonly branchId: BranchId;
  readonly closingType: ClosingType;
  readonly unitId?: string;
  readonly unitModel?: string;
  readonly unitPrice?: number;
  readonly campaignId?: string;
  readonly adId?: string;
  readonly commissionIdr?: number;
  readonly commissionPct?: number;
  readonly notes?: string;
  readonly testDriveAt?: Date;
  readonly spkAt?: Date;
  readonly createdAt: Date;
}

/** One immutable record of a test drive, SPK, or cancellation (spec table `closings`) — carries campaign attribution for Samantha's feed-back loop (`GetClosingStats`). */
export class Closing {
  private constructor(private readonly props: ClosingProps) {}

  static create(props: ClosingProps): Result<Closing, ValidationError> {
    if (props.unitPrice !== undefined && props.unitPrice < 0) {
      return err(new ValidationError("Closing.unitPrice must not be negative"));
    }
    if (props.commissionIdr !== undefined && props.commissionIdr < 0) {
      return err(new ValidationError("Closing.commissionIdr must not be negative"));
    }
    return ok(new Closing({ ...props }));
  }

  get id(): ClosingId {
    return this.props.id;
  }

  get leadId(): LeadId {
    return this.props.leadId;
  }

  get salesHumanId(): SalesHumanId {
    return this.props.salesHumanId;
  }

  get branchId(): BranchId {
    return this.props.branchId;
  }

  get closingType(): ClosingType {
    return this.props.closingType;
  }

  get unitId(): string | undefined {
    return this.props.unitId;
  }

  get unitModel(): string | undefined {
    return this.props.unitModel;
  }

  get unitPrice(): number | undefined {
    return this.props.unitPrice;
  }

  get campaignId(): string | undefined {
    return this.props.campaignId;
  }

  get adId(): string | undefined {
    return this.props.adId;
  }

  get commissionIdr(): number | undefined {
    return this.props.commissionIdr;
  }

  get commissionPct(): number | undefined {
    return this.props.commissionPct;
  }

  get notes(): string | undefined {
    return this.props.notes;
  }

  get testDriveAt(): Date | undefined {
    return this.props.testDriveAt;
  }

  get spkAt(): Date | undefined {
    return this.props.spkAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
