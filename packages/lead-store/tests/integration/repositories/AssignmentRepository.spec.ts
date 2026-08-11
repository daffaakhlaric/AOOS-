import { AssignmentMode, BranchId, SalesHumanId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { Assignment } from "../../../src/domain/entities/Assignment.js";
import { AssignmentId } from "../../../src/domain/value-objects/AssignmentId.js";
import { LeadId } from "../../../src/domain/value-objects/LeadId.js";
import { AssignmentRepository } from "../../../src/infrastructure/supabase/AssignmentRepository.js";
import { makeAssignmentRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

function makeAssignment() {
  return unwrap(
    Assignment.create({
      id: AssignmentId.generate(),
      leadId: LeadId.generate(),
      branchId: BranchId.BINTARO,
      salesHumanId: SalesHumanId.generate(),
      assignmentMode: AssignmentMode.SMART_ASSIGN,
      assignedAt: new Date(),
      status: "ACTIVE",
    }),
  );
}

describe("AssignmentRepository", () => {
  it("insert adds a new row", async () => {
    const client = createFakeSupabaseClient();
    const repo = new AssignmentRepository(client);
    const inserted = unwrap(await repo.insert(makeAssignment()));
    expect(inserted.status).toBe("ACTIVE");
    expect(client.rows("assignments")).toHaveLength(1);
  });

  it("insert surfaces 'no row returned' when the write resolves with no data", async () => {
    const client = createFakeSupabaseClient();
    client.forceNullOnce("assignments");
    const repo = new AssignmentRepository(client);
    const error = unwrapErr(await repo.insert(makeAssignment()));
    expect(error.message).toContain("no row returned");
  });

  it("insert surfaces a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("assignments", "db error");
    const repo = new AssignmentRepository(client);
    const error = unwrapErr(await repo.insert(makeAssignment()));
    expect(error.message).toContain("db error");
  });

  it("findByLeadId returns every assignment for the lead", async () => {
    const client = createFakeSupabaseClient();
    const leadId = "lead-shared";
    client.seed("assignments", [
      makeAssignmentRow({ lead_id: leadId, assigned_at: "2026-01-15T09:00:00.000Z" }),
      makeAssignmentRow({ lead_id: "other-lead" }),
    ]);
    const repo = new AssignmentRepository(client);
    const result = unwrap(await repo.findByLeadId(unwrap(LeadId.create(leadId))));
    expect(result).toHaveLength(1);
  });

  it("findByLeadId surfaces a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("assignments", "timeout");
    const repo = new AssignmentRepository(client);
    const error = unwrapErr(await repo.findByLeadId(LeadId.generate()));
    expect(error.message).toContain("timeout");
  });

  it("findByLeadId propagates a mapping failure (invalid status)", async () => {
    const client = createFakeSupabaseClient();
    const leadId = "lead-bad";
    client.seed("assignments", [makeAssignmentRow({ lead_id: leadId, status: "PENDING" })]);
    const repo = new AssignmentRepository(client);
    const error = unwrapErr(await repo.findByLeadId(unwrap(LeadId.create(leadId))));
    expect(error.message).toContain("invalid status");
  });

  it("findByLeadId propagates a mapping failure (invalid branch_id)", async () => {
    const client = createFakeSupabaseClient();
    const leadId = "lead-bad-2";
    client.seed("assignments", [makeAssignmentRow({ lead_id: leadId, branch_id: "MARS" })]);
    const repo = new AssignmentRepository(client);
    const error = unwrapErr(await repo.findByLeadId(unwrap(LeadId.create(leadId))));
    expect(error.message).toContain("invalid branch_id");
  });

  it("findByLeadId propagates a mapping failure (invalid assignment_mode)", async () => {
    const client = createFakeSupabaseClient();
    const leadId = "lead-bad-3";
    client.seed("assignments", [
      makeAssignmentRow({ lead_id: leadId, assignment_mode: "COIN_FLIP" }),
    ]);
    const repo = new AssignmentRepository(client);
    const error = unwrapErr(await repo.findByLeadId(unwrap(LeadId.create(leadId))));
    expect(error.message).toContain("invalid assignment_mode");
  });
});
