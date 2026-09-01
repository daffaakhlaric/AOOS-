import { AssignmentMode, BranchId, SalesHumanId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { RecordAssignment } from "../../../src/application/use-cases/RecordAssignment.js";
import { LeadStoreEvents } from "../../../src/domain/events/LeadStoreEvents.js";
import { AssignmentRepository } from "../../../src/infrastructure/supabase/AssignmentRepository.js";
import { LeadRepository } from "../../../src/infrastructure/supabase/LeadRepository.js";
import { makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

function setup(status = "HOT") {
  const client = createFakeSupabaseClient();
  const row = makeLeadRow({ status, tenant_id: "t1" });
  client.seed("leads", [row]);
  const leadRepository = new LeadRepository(client);
  const assignmentRepository = new AssignmentRepository(client);
  const publisher = createFakePublisher();
  const events = new LeadStoreEvents(publisher);
  const useCase = new RecordAssignment(
    leadRepository,
    assignmentRepository,
    events,
    () => new Date(),
  );
  return { client, useCase, row, publisher };
}

describe("RecordAssignment", () => {
  it("assigns a lead -> status = ASSIGNED", async () => {
    const { useCase, client, row } = setup();
    const salesHumanId = SalesHumanId.generate();
    await useCase.execute({
      leadId: row.id,
      salesHumanId: salesHumanId.toString(),
      assignmentMode: AssignmentMode.SMART_ASSIGN,
      branchId: BranchId.BINTARO,
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(client.rows("leads")[0]?.status).toBe("ASSIGNED");
    expect(client.rows("leads")[0]?.assigned_sales_id).toBe(salesHumanId.toString());
  });

  it("emits LeadAssigned with the correct salesHumanId", async () => {
    const { useCase, row, publisher } = setup();
    const salesHumanId = SalesHumanId.generate();
    await useCase.execute({
      leadId: row.id,
      salesHumanId: salesHumanId.toString(),
      assignmentMode: AssignmentMode.ROUND_ROBIN,
      branchId: BranchId.BINTARO,
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(publisher.published[0]).toMatchObject({
      type: "aaos.lead-store.lead.assigned",
      payload: {
        salesHumanId: salesHumanId.toString(),
        assignmentMode: AssignmentMode.ROUND_ROBIN,
      },
    });
  });

  it("inserts an assignments row", async () => {
    const { useCase, client, row } = setup();
    await useCase.execute({
      leadId: row.id,
      salesHumanId: SalesHumanId.generate().toString(),
      assignmentMode: AssignmentMode.MANUAL,
      branchId: BranchId.BINTARO,
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(client.rows("assignments")).toHaveLength(1);
  });

  it("rejects assigning an already-CLOSED lead", async () => {
    const { useCase, row } = setup("CLOSED");
    const error = unwrapErr(
      await useCase.execute({
        leadId: row.id,
        salesHumanId: SalesHumanId.generate().toString(),
        assignmentMode: AssignmentMode.SMART_ASSIGN,
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("CLOSED");
  });

  it("surfaces a repository error on the assignment insert", async () => {
    const { useCase, client, row } = setup();
    client.forceErrorOnce("assignments", "db error");
    const error = unwrapErr(
      await useCase.execute({
        leadId: row.id,
        salesHumanId: SalesHumanId.generate().toString(),
        assignmentMode: AssignmentMode.SMART_ASSIGN,
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("db error");
  });

  it("surfaces a repository error on the lead update", async () => {
    const { useCase, client, row } = setup();
    // skip=1: let the earlier findById(lead) select succeed; force the later update to fail.
    client.forceErrorOnce("leads", "row locked", 1);
    const error = unwrapErr(
      await useCase.execute({
        leadId: row.id,
        salesHumanId: SalesHumanId.generate().toString(),
        assignmentMode: AssignmentMode.SMART_ASSIGN,
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("row locked");
  });

  it("rejects an empty salesHumanId", async () => {
    const { useCase, row } = setup();
    const error = unwrapErr(
      await useCase.execute({
        leadId: row.id,
        salesHumanId: "",
        assignmentMode: AssignmentMode.SMART_ASSIGN,
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("validation failed");
  });

  it("rejects a whitespace-only leadId (passes Zod's min(1), fails LeadId.create's trim check)", async () => {
    const { useCase } = setup();
    const error = unwrapErr(
      await useCase.execute({
        leadId: "   ",
        salesHumanId: SalesHumanId.generate().toString(),
        assignmentMode: AssignmentMode.SMART_ASSIGN,
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("LeadId");
  });

  it("rejects a whitespace-only salesHumanId (passes Zod's min(1), fails SalesHumanId.create's trim check)", async () => {
    const { useCase, row } = setup();
    const error = unwrapErr(
      await useCase.execute({
        leadId: row.id,
        salesHumanId: "   ",
        assignmentMode: AssignmentMode.SMART_ASSIGN,
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("SalesHumanId");
  });

  it("surfaces a repository error on the initial lead lookup", async () => {
    const { useCase, client, row } = setup();
    client.forceErrorOnce("leads", "connection reset");
    const error = unwrapErr(
      await useCase.execute({
        leadId: row.id,
        salesHumanId: SalesHumanId.generate().toString(),
        assignmentMode: AssignmentMode.SMART_ASSIGN,
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("connection reset");
  });

  it("returns LeadNotFoundError for an unknown lead", async () => {
    const { useCase } = setup();
    const error = unwrapErr(
      await useCase.execute({
        leadId: "unknown",
        salesHumanId: SalesHumanId.generate().toString(),
        assignmentMode: AssignmentMode.SMART_ASSIGN,
        branchId: BranchId.BINTARO,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("not found");
  });
});
