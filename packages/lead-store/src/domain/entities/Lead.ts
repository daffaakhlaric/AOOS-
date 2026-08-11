import type { AssignmentMode, BranchId, SalesHumanId } from "@aos/branch-manager";
import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { PhoneNumber, PhoneNumberId } from "@aos/whatsapp-connector";

import type { LeadId } from "../value-objects/LeadId.js";
import type { LeadSource } from "../value-objects/LeadSource.js";
import {
  isPreAssignmentStatus,
  LeadStatus,
  type TemperatureStatus,
} from "../value-objects/LeadStatus.js";

export interface LeadQualificationFlags {
  readonly budget: boolean;
  readonly unit: boolean;
  readonly area: boolean;
  readonly payment: boolean;
  readonly timeline: boolean;
  readonly name: boolean;
}

export interface LeadProps {
  readonly id: LeadId;
  readonly tenantId: string;
  readonly leadSource: LeadSource;
  readonly campaignId?: string;
  readonly adId?: string;
  readonly adAccountId?: string;
  readonly leadPhone: PhoneNumber;
  readonly leadName?: string;
  readonly branchId: BranchId;
  readonly wabaPhoneNumberId: PhoneNumberId;
  readonly status: LeadStatus;
  readonly score: number;
  readonly temperature: TemperatureStatus;
  readonly qualification: LeadQualificationFlags;
  readonly assignedSalesId?: SalesHumanId;
  readonly assignedAt?: Date;
  readonly assignmentMode?: AssignmentMode;
  readonly firstMessageAt?: Date;
  readonly lastMessageAt?: Date;
  readonly becameHotAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** The single source of truth for one lead's qualification and workflow state (spec table `leads`). Immutable — every mutation (`withStatus`, `withScore`, ...) returns a NEW `Lead`. */
export class Lead {
  private constructor(private readonly props: LeadProps) {}

  static create(props: LeadProps): Result<Lead, ValidationError> {
    if (props.score < 0 || props.score > 100) {
      return err(
        new ValidationError(`Lead.score must be within [0, 100], received: ${props.score}`),
      );
    }
    if (typeof props.tenantId !== "string" || props.tenantId.trim().length === 0) {
      return err(new ValidationError("Lead.tenantId must be a non-empty string"));
    }
    return ok(new Lead({ ...props }));
  }

  get id(): LeadId {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get leadSource(): LeadSource {
    return this.props.leadSource;
  }

  get campaignId(): string | undefined {
    return this.props.campaignId;
  }

  get adId(): string | undefined {
    return this.props.adId;
  }

  get adAccountId(): string | undefined {
    return this.props.adAccountId;
  }

  get leadPhone(): PhoneNumber {
    return this.props.leadPhone;
  }

  get leadName(): string | undefined {
    return this.props.leadName;
  }

  get branchId(): BranchId {
    return this.props.branchId;
  }

  get wabaPhoneNumberId(): PhoneNumberId {
    return this.props.wabaPhoneNumberId;
  }

  get status(): LeadStatus {
    return this.props.status;
  }

  get score(): number {
    return this.props.score;
  }

  get temperature(): TemperatureStatus {
    return this.props.temperature;
  }

  get qualification(): LeadQualificationFlags {
    return this.props.qualification;
  }

  get assignedSalesId(): SalesHumanId | undefined {
    return this.props.assignedSalesId;
  }

  get assignedAt(): Date | undefined {
    return this.props.assignedAt;
  }

  get assignmentMode(): AssignmentMode | undefined {
    return this.props.assignmentMode;
  }

  get firstMessageAt(): Date | undefined {
    return this.props.firstMessageAt;
  }

  get lastMessageAt(): Date | undefined {
    return this.props.lastMessageAt;
  }

  get becameHotAt(): Date | undefined {
    return this.props.becameHotAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  withStatus(status: LeadStatus, updatedAt: Date): Lead {
    return new Lead({ ...this.props, status, updatedAt });
  }

  withScore(
    score: number,
    temperature: TemperatureStatus,
    updatedAt: Date,
    becameHotAt?: Date,
  ): Lead {
    return new Lead({
      ...this.props,
      score,
      temperature,
      updatedAt,
      becameHotAt: becameHotAt ?? this.props.becameHotAt,
      status: isPreAssignmentStatus(this.props.status) ? temperature : this.props.status,
    });
  }

  withAssignment(
    assignedSalesId: SalesHumanId,
    assignmentMode: AssignmentMode,
    assignedAt: Date,
  ): Lead {
    return new Lead({
      ...this.props,
      status: LeadStatus.ASSIGNED,
      assignedSalesId,
      assignmentMode,
      assignedAt,
      updatedAt: assignedAt,
    });
  }

  withClosed(updatedAt: Date): Lead {
    return new Lead({ ...this.props, status: LeadStatus.CLOSED, updatedAt });
  }

  withLastMessageAt(lastMessageAt: Date, firstMessageAt?: Date): Lead {
    return new Lead({
      ...this.props,
      lastMessageAt,
      firstMessageAt: this.props.firstMessageAt ?? firstMessageAt ?? lastMessageAt,
      updatedAt: lastMessageAt,
    });
  }
}
