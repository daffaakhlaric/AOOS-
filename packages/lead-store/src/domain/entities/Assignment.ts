import type { BranchId, SalesHumanId } from "@aos/branch-manager";
import { AssignmentMode } from "@aos/branch-manager";
import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { AssignmentId } from "../value-objects/AssignmentId.js";
import type { LeadId } from "../value-objects/LeadId.js";

export type AssignmentStatus = "ACTIVE" | "RELEASED";

export interface AssignmentProps {
  readonly id: AssignmentId;
  readonly leadId: LeadId;
  readonly branchId: BranchId;
  readonly salesHumanId: SalesHumanId;
  readonly assignmentMode: AssignmentMode;
  readonly assignedAt: Date;
  readonly releasedAt?: Date;
  readonly status: AssignmentStatus;
}

/** One immutable record of a lead having been assigned to a sales human (spec table `assignments`) — persists what `@aos/branch-manager` decided. */
export class Assignment {
  private constructor(private readonly props: AssignmentProps) {}

  static create(props: AssignmentProps): Result<Assignment, ValidationError> {
    if (!Object.values(AssignmentMode).includes(props.assignmentMode)) {
      return err(
        new ValidationError(
          `Assignment.assignmentMode must be a valid AssignmentMode, received: ${String(props.assignmentMode)}`,
        ),
      );
    }
    return ok(new Assignment({ ...props }));
  }

  get id(): AssignmentId {
    return this.props.id;
  }

  get leadId(): LeadId {
    return this.props.leadId;
  }

  get branchId(): BranchId {
    return this.props.branchId;
  }

  get salesHumanId(): SalesHumanId {
    return this.props.salesHumanId;
  }

  get assignmentMode(): AssignmentMode {
    return this.props.assignmentMode;
  }

  get assignedAt(): Date {
    return this.props.assignedAt;
  }

  get releasedAt(): Date | undefined {
    return this.props.releasedAt;
  }

  get status(): AssignmentStatus {
    return this.props.status;
  }
}
