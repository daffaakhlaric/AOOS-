import { describe, expect, it } from "vitest";

import { LeadAssignment } from "../../../src/domain/entities/LeadAssignment.js";
import { AssignmentId } from "../../../src/domain/value-objects/AssignmentId.js";
import { AssignmentMode } from "../../../src/domain/value-objects/AssignmentMode.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { SalesHumanId } from "../../../src/domain/value-objects/SalesHumanId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const ASSIGNED_AT = new Date("2026-01-15T09:00:00.000Z");

function validProps() {
  return {
    id: AssignmentId.generate(),
    leadId: "lead-1",
    branchId: BranchId.BINTARO,
    salesHumanId: SalesHumanId.generate(),
    assignedAt: ASSIGNED_AT,
    assignmentMode: AssignmentMode.SMART_ASSIGN,
  };
}

describe("LeadAssignment entity", () => {
  it("creates with valid props and exposes every getter", () => {
    const props = validProps();
    const assignment = unwrap(LeadAssignment.create(props));
    expect(assignment.id).toBe(props.id);
    expect(assignment.leadId).toBe("lead-1");
    expect(assignment.branchId).toBe(BranchId.BINTARO);
    expect(assignment.salesHumanId).toBe(props.salesHumanId);
    expect(assignment.assignedAt).toBe(ASSIGNED_AT);
    expect(assignment.assignmentMode).toBe(AssignmentMode.SMART_ASSIGN);
    expect(assignment.metadata).toBeUndefined();
  });

  it("accepts optional metadata", () => {
    const assignment = unwrap(
      LeadAssignment.create({ ...validProps(), metadata: { source: "meta-ads" } }),
    );
    expect(assignment.metadata).toEqual({ source: "meta-ads" });
  });

  it("rejects an empty leadId", () => {
    expect(unwrapErr(LeadAssignment.create({ ...validProps(), leadId: "" })).message).toContain(
      "leadId must be a non-empty string",
    );
  });
});
