import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { AssignmentId } from "../value-objects/AssignmentId.js";
import type { AssignmentMode } from "../value-objects/AssignmentMode.js";
import type { BranchId } from "../value-objects/BranchId.js";
import type { SalesHumanId } from "../value-objects/SalesHumanId.js";

export interface LeadAssignmentProps {
  readonly id: AssignmentId;
  readonly leadId: string;
  readonly branchId: BranchId;
  readonly salesHumanId: SalesHumanId;
  readonly assignedAt: Date;
  readonly assignmentMode: AssignmentMode;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** An immutable record of one lead having been assigned to one sales human — produced by `LeadAssignmentService` on every successful assignment (never on a queued/pending outcome). */
export class LeadAssignment {
  private constructor(private readonly props: LeadAssignmentProps) {}

  static create(props: LeadAssignmentProps): Result<LeadAssignment, ValidationError> {
    if (typeof props.leadId !== "string" || props.leadId.trim().length === 0) {
      return err(new ValidationError("LeadAssignment.leadId must be a non-empty string"));
    }
    return ok(new LeadAssignment({ ...props }));
  }

  get id(): AssignmentId {
    return this.props.id;
  }

  get leadId(): string {
    return this.props.leadId;
  }

  get branchId(): BranchId {
    return this.props.branchId;
  }

  get salesHumanId(): SalesHumanId {
    return this.props.salesHumanId;
  }

  get assignedAt(): Date {
    return this.props.assignedAt;
  }

  get assignmentMode(): AssignmentMode {
    return this.props.assignmentMode;
  }

  get metadata(): Readonly<Record<string, unknown>> | undefined {
    return this.props.metadata;
  }
}
