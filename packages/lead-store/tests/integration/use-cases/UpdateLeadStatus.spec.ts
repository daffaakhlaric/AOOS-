import { describe, expect, it } from "vitest";

import { UpdateLeadStatus } from "../../../src/application/use-cases/UpdateLeadStatus.js";
import { LeadStoreEvents } from "../../../src/domain/events/LeadStoreEvents.js";
import { LeadStatus } from "../../../src/domain/value-objects/LeadStatus.js";
import { LeadRepository } from "../../../src/infrastructure/supabase/LeadRepository.js";
import { makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

function setup(status: string) {
  const client = createFakeSupabaseClient();
  const row = makeLeadRow({ status, tenant_id: "t1" });
  client.seed("leads", [row]);
  const leadRepository = new LeadRepository(client);
  const events = new LeadStoreEvents(createFakePublisher());
  const useCase = new UpdateLeadStatus(leadRepository, events, () => new Date());
  return { client, useCase, row };
}

describe("UpdateLeadStatus", () => {
  it("NEW -> COLD -> WARM -> HOT (pinned happy path)", async () => {
    const { useCase, row } = setup("NEW");
    let lead = unwrap(
      await useCase.execute({
        leadId: row.id,
        toStatus: LeadStatus.COLD,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(lead.status).toBe("COLD");
    lead = unwrap(
      await useCase.execute({
        leadId: row.id,
        toStatus: LeadStatus.WARM,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(lead.status).toBe("WARM");
    lead = unwrap(
      await useCase.execute({
        leadId: row.id,
        toStatus: LeadStatus.HOT,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(lead.status).toBe("HOT");
  });

  it("invalid transition -> error (direct to ASSIGNED)", async () => {
    const { useCase, row } = setup("HOT");
    const error = unwrapErr(
      await useCase.execute({
        leadId: row.id,
        toStatus: LeadStatus.ASSIGNED,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("RecordAssignment");
  });

  it("invalid transition -> error (direct to CLOSED)", async () => {
    const { useCase, row } = setup("HOT");
    const error = unwrapErr(
      await useCase.execute({
        leadId: row.id,
        toStatus: LeadStatus.CLOSED,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("RecordClosing");
  });

  it("rejects any transition once CLOSED", async () => {
    const { useCase, row } = setup("CLOSED");
    const error = unwrapErr(
      await useCase.execute({
        leadId: row.id,
        toStatus: LeadStatus.WARM,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("terminal");
  });

  it("emits LeadStatusChanged on success", async () => {
    const client = createFakeSupabaseClient();
    const row = makeLeadRow({ status: "NEW", tenant_id: "t1" });
    client.seed("leads", [row]);
    const leadRepository = new LeadRepository(client);
    const publisher = createFakePublisher();
    const events = new LeadStoreEvents(publisher);
    const useCase = new UpdateLeadStatus(leadRepository, events, () => new Date());
    await useCase.execute({
      leadId: row.id,
      toStatus: LeadStatus.WARM,
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(publisher.published[0]).toMatchObject({ type: "aaos.lead-store.lead.status-changed" });
  });

  it("returns LeadNotFoundError for an unknown lead id", async () => {
    const { useCase } = setup("NEW");
    const error = unwrapErr(
      await useCase.execute({
        leadId: "unknown-id",
        toStatus: LeadStatus.WARM,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("not found");
  });

  it("rejects an empty leadId", async () => {
    const { useCase } = setup("NEW");
    const error = unwrapErr(
      await useCase.execute({
        leadId: "",
        toStatus: LeadStatus.WARM,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(error.message).toContain("LeadId");
  });
});
