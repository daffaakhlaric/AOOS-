import { AssignmentMode, BranchId, SalesHumanId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { Assignment } from "../../../src/domain/entities/Assignment.js";
import { AssignmentId } from "../../../src/domain/value-objects/AssignmentId.js";
import { LeadId } from "../../../src/domain/value-objects/LeadId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const NOW = new Date("2026-01-15T09:00:00.000Z");

function baseProps() {
  return {
    id: AssignmentId.generate(),
    leadId: LeadId.generate(),
    branchId: BranchId.BINTARO,
    salesHumanId: SalesHumanId.generate(),
    assignmentMode: AssignmentMode.SMART_ASSIGN,
    assignedAt: NOW,
    status: "ACTIVE" as const,
  };
}

describe("Assignment entity", () => {
  it("creates a valid assignment", () => {
    const assignment = unwrap(Assignment.create(baseProps()));
    expect(assignment.status).toBe("ACTIVE");
    expect(assignment.assignmentMode).toBe(AssignmentMode.SMART_ASSIGN);
  });

  it("rejects an invalid assignmentMode", () => {
    const error = unwrapErr(
      Assignment.create({ ...baseProps(), assignmentMode: "BOGUS" as unknown as AssignmentMode }),
    );
    expect(error.message).toContain("assignmentMode");
  });

  it("exposes releasedAt when provided", () => {
    const assignment = unwrap(
      Assignment.create({ ...baseProps(), releasedAt: NOW, status: "RELEASED" }),
    );
    expect(assignment.releasedAt).toBe(NOW);
    expect(assignment.status).toBe("RELEASED");
  });

  it("exposes every getter matching the constructed props", () => {
    const props = baseProps();
    const assignment = unwrap(Assignment.create(props));
    expect(assignment.id).toBe(props.id);
    expect(assignment.leadId).toBe(props.leadId);
    expect(assignment.branchId).toBe(BranchId.BINTARO);
    expect(assignment.salesHumanId).toBe(props.salesHumanId);
    expect(assignment.assignedAt).toBe(NOW);
  });
});
