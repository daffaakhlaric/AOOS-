import type { Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import { LeadAssignment } from "../domain/entities/LeadAssignment.js";
import { AssignmentId } from "../domain/value-objects/AssignmentId.js";
import { AssignmentMode } from "../domain/value-objects/AssignmentMode.js";
import { BranchId } from "../domain/value-objects/BranchId.js";
import { SalesHumanId } from "../domain/value-objects/SalesHumanId.js";

/** Fluent builder (Builder Pattern) for `LeadAssignment`, with sensible defaults so callers only override what matters for their scenario. */
export class LeadAssignmentBuilder {
  private id: AssignmentId = AssignmentId.generate();
  private leadId = "lead-1";
  private branchId: BranchId = BranchId.BINTARO;
  private salesHumanId: SalesHumanId = SalesHumanId.generate();
  private assignedAt = new Date("2026-01-01T00:00:00.000Z");
  private assignmentMode: AssignmentMode = AssignmentMode.SMART_ASSIGN;
  private metadata: Readonly<Record<string, unknown>> | undefined;

  withId(id: AssignmentId): this {
    this.id = id;
    return this;
  }

  withLeadId(leadId: string): this {
    this.leadId = leadId;
    return this;
  }

  withBranchId(branchId: BranchId): this {
    this.branchId = branchId;
    return this;
  }

  withSalesHumanId(salesHumanId: SalesHumanId): this {
    this.salesHumanId = salesHumanId;
    return this;
  }

  withAssignedAt(at: Date): this {
    this.assignedAt = at;
    return this;
  }

  withAssignmentMode(mode: AssignmentMode): this {
    this.assignmentMode = mode;
    return this;
  }

  withMetadata(metadata: Readonly<Record<string, unknown>>): this {
    this.metadata = metadata;
    return this;
  }

  build(): Result<LeadAssignment, ValidationError> {
    return LeadAssignment.create({
      id: this.id,
      leadId: this.leadId,
      branchId: this.branchId,
      salesHumanId: this.salesHumanId,
      assignedAt: this.assignedAt,
      assignmentMode: this.assignmentMode,
      metadata: this.metadata,
    });
  }
}
