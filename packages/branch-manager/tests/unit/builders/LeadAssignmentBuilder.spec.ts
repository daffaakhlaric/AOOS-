import { describe, expect, it } from "vitest";

import { LeadAssignmentBuilder } from "../../../src/builders/LeadAssignmentBuilder.js";
import { AssignmentId } from "../../../src/domain/value-objects/AssignmentId.js";
import { AssignmentMode } from "../../../src/domain/value-objects/AssignmentMode.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { SalesHumanId } from "../../../src/domain/value-objects/SalesHumanId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("LeadAssignmentBuilder", () => {
  it("builds with sensible defaults", () => {
    const assignment = unwrap(new LeadAssignmentBuilder().build());
    expect(assignment.leadId).toBe("lead-1");
    expect(assignment.branchId).toBe(BranchId.BINTARO);
    expect(assignment.assignmentMode).toBe(AssignmentMode.SMART_ASSIGN);
    expect(assignment.metadata).toBeUndefined();
  });

  it("applies every with-method override", () => {
    const id = AssignmentId.generate();
    const salesHumanId = SalesHumanId.generate();
    const assignedAt = new Date("2026-03-01T00:00:00.000Z");
    const assignment = unwrap(
      new LeadAssignmentBuilder()
        .withId(id)
        .withLeadId("lead-99")
        .withBranchId(BranchId.BANDUNG)
        .withSalesHumanId(salesHumanId)
        .withAssignedAt(assignedAt)
        .withAssignmentMode(AssignmentMode.ROUND_ROBIN)
        .withMetadata({ campaign: "meta-x" })
        .build(),
    );
    expect(assignment.id).toBe(id);
    expect(assignment.leadId).toBe("lead-99");
    expect(assignment.branchId).toBe(BranchId.BANDUNG);
    expect(assignment.salesHumanId).toBe(salesHumanId);
    expect(assignment.assignedAt).toBe(assignedAt);
    expect(assignment.assignmentMode).toBe(AssignmentMode.ROUND_ROBIN);
    expect(assignment.metadata).toEqual({ campaign: "meta-x" });
  });

  it("propagates a LeadAssignment.create validation failure (empty leadId)", () => {
    expect(unwrapErr(new LeadAssignmentBuilder().withLeadId("").build()).message).toContain(
      "leadId must be a non-empty string",
    );
  });
});
