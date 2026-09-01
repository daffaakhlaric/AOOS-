import { SalesHumanId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { RecordClosing } from "../../../src/application/use-cases/RecordClosing.js";
import { LeadStoreEvents } from "../../../src/domain/events/LeadStoreEvents.js";
import { ClosingType } from "../../../src/domain/value-objects/ClosingType.js";
import { ClosingRepository } from "../../../src/infrastructure/supabase/ClosingRepository.js";
import { LeadRepository } from "../../../src/infrastructure/supabase/LeadRepository.js";
import { makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

function setup() {
  const client = createFakeSupabaseClient();
  const row = makeLeadRow({
    status: "ASSIGNED",
    campaign_id: "#C047",
    ad_id: "#A001",
    tenant_id: "t1",
  });
  client.seed("leads", [row]);
  const leadRepository = new LeadRepository(client);
  const closingRepository = new ClosingRepository(client);
  const publisher = createFakePublisher();
  const events = new LeadStoreEvents(publisher);
  const useCase = new RecordClosing(leadRepository, closingRepository, events, () => new Date());
  return { client, useCase, row, publisher };
}

describe("RecordClosing", () => {
  it("SPK recorded -> lead status = CLOSED", async () => {
    const { useCase, client, row } = setup();
    await useCase.execute({
      leadId: row.id,
      salesHumanId: SalesHumanId.generate().toString(),
      closingType: ClosingType.SPK,
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(client.rows("leads")[0]?.status).toBe("CLOSED");
  });

  it("emits ClosingRecorded (Samantha can listen)", async () => {
    const { useCase, row, publisher } = setup();
    await useCase.execute({
      leadId: row.id,
      salesHumanId: SalesHumanId.generate().toString(),
      closingType: ClosingType.SPK,
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(publisher.published[0]).toMatchObject({ type: "aaos.lead-store.closing.recorded" });
  });

  it("stores commission fields correctly", async () => {
    const { useCase, client, row } = setup();
    const closing = unwrap(
      await useCase.execute({
        leadId: row.id,
        salesHumanId: SalesHumanId.generate().toString(),
        closingType: ClosingType.SPK,
        commissionIdr: 2_000_000,
        commissionPct: 1.5,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(closing.commissionIdr).toBe(2_000_000);
    expect(closing.commissionPct).toBe(1.5);
    expect(client.rows("closings")[0]?.commission_idr).toBe(2_000_000);
  });

  it("inherits campaignId/adId from the lead when not explicitly provided", async () => {
    const { useCase, row } = setup();
    const closing = unwrap(
      await useCase.execute({
        leadId: row.id,
        salesHumanId: SalesHumanId.generate().toString(),
        closingType: ClosingType.SPK,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(closing.campaignId).toBe("#C047");
    expect(closing.adId).toBe("#A001");
  });

  it("sets spkAt for SPK closings and testDriveAt for TEST_DRIVE closings", async () => {
    const { useCase, row } = setup();
    const spk = unwrap(
      await useCase.execute({
        leadId: row.id,
        salesHumanId: SalesHumanId.generate().toString(),
        closingType: ClosingType.SPK,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(spk.spkAt).toBeDefined();
    expect(spk.testDriveAt).toBeUndefined();
  });

  it("surfaces a repository error on the closing insert", async () => {
    const { useCase, client, row } = setup();
    client.forceErrorOnce("closings", "db error");
    const error = unwrapErr(
      await useCase.execute({
        leadId: row.id,
        salesHumanId: SalesHumanId.generate().toString(),
        closingType: ClosingType.SPK,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("db error");
  });

  it("surfaces a repository error on the lead update", async () => {
    const { useCase, client, row } = setup();
    client.forceErrorOnce("leads", "row locked", 1);
    const error = unwrapErr(
      await useCase.execute({
        leadId: row.id,
        salesHumanId: SalesHumanId.generate().toString(),
        closingType: ClosingType.SPK,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("row locked");
  });

  it("rejects a whitespace-only leadId (passes Zod's min(1), fails LeadId.create's trim check)", async () => {
    const { useCase } = setup();
    const error = unwrapErr(
      await useCase.execute({
        leadId: "   ",
        salesHumanId: SalesHumanId.generate().toString(),
        closingType: ClosingType.SPK,
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
        closingType: ClosingType.SPK,
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
        closingType: ClosingType.SPK,
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
        closingType: ClosingType.SPK,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("not found");
  });

  it("rejects an invalid closingType", async () => {
    const { useCase, row } = setup();
    const error = unwrapErr(
      await useCase.execute({
        leadId: row.id,
        salesHumanId: SalesHumanId.generate().toString(),
        closingType: "REFUND" as ClosingType,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("validation failed");
  });
});
