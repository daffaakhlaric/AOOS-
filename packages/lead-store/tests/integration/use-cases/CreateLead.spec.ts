import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { CreateLead } from "../../../src/application/use-cases/CreateLead.js";
import { LeadStoreEvents } from "../../../src/domain/events/LeadStoreEvents.js";
import { LeadSource } from "../../../src/domain/value-objects/LeadSource.js";
import { ConversationRepository } from "../../../src/infrastructure/supabase/ConversationRepository.js";
import { LeadRepository } from "../../../src/infrastructure/supabase/LeadRepository.js";
import { fixedClock } from "../../fixtures/leadStoreFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

function setup() {
  const client = createFakeSupabaseClient();
  const leadRepository = new LeadRepository(client);
  const conversationRepository = new ConversationRepository(client);
  const publisher = createFakePublisher();
  const events = new LeadStoreEvents(publisher);
  const useCase = new CreateLead(leadRepository, conversationRepository, events, fixedClock());
  return { client, leadRepository, conversationRepository, publisher, useCase };
}

const validInput = {
  leadSource: LeadSource.CTWA,
  leadPhone: "+6281200000099",
  branchId: BranchId.BINTARO,
  wabaPhoneNumberId: "waba-bintaro-1",
  campaignId: "#C047",
  adId: "#A001",
  tenantId: "dss-motor",
  correlationId: "corr-1",
};

describe("CreateLead", () => {
  it("creates a lead + conversation in one operation", async () => {
    const { useCase, client } = setup();
    const lead = unwrap(await useCase.execute(validInput));
    expect(lead.leadPhone.toString()).toBe("+6281200000099");
    expect(lead.status).toBe("NEW");
    expect(lead.score).toBe(0);
    expect(client.rows("leads")).toHaveLength(1);
    expect(client.rows("conversations")).toHaveLength(1);
  });

  it("emits LeadCreated on a real insert", async () => {
    const { useCase, publisher } = setup();
    await useCase.execute(validInput);
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]).toMatchObject({ type: "aaos.lead-store.lead.created" });
  });

  it("duplicate phone + branch -> returns existing (no duplicate insert, no event)", async () => {
    const { useCase, client, publisher } = setup();
    const first = unwrap(await useCase.execute(validInput));
    const second = unwrap(await useCase.execute(validInput));

    expect(second.id.toString()).toBe(first.id.toString());
    expect(client.rows("leads")).toHaveLength(1); // still only 1
    expect(publisher.published).toHaveLength(1); // only the first call emitted
  });

  it("different branch with the same phone creates a second, distinct lead", async () => {
    const { useCase, client } = setup();
    await useCase.execute(validInput);
    await useCase.execute({ ...validInput, branchId: BranchId.CINERE });
    expect(client.rows("leads")).toHaveLength(2);
  });

  it("rejects an invalid leadPhone", async () => {
    const { useCase } = setup();
    const error = unwrapErr(await useCase.execute({ ...validInput, leadPhone: "0812" }));
    expect(error.message).toContain("PhoneNumber");
  });

  it("rejects an invalid wabaPhoneNumberId", async () => {
    const { useCase } = setup();
    const error = unwrapErr(await useCase.execute({ ...validInput, wabaPhoneNumberId: "" }));
    expect(error.message).toContain("PhoneNumberId");
  });

  it("rejects a missing tenantId (schema validation)", async () => {
    const { useCase } = setup();
    const error = unwrapErr(await useCase.execute({ ...validInput, tenantId: "" }));
    expect(error.message).toContain("validation failed");
  });

  it("surfaces a repository error on insert", async () => {
    const { useCase, client } = setup();
    // skip=1: let the earlier findByPhoneAndBranch select succeed; force the insert to fail.
    client.forceErrorOnce("leads", "db down", 1);
    const error = unwrapErr(await useCase.execute(validInput));
    expect(error.message).toContain("db down");
  });

  it("surfaces a repository error on the conversation insert", async () => {
    const { useCase, client } = setup();
    client.forceErrorOnce("conversations", "fk violation");
    const error = unwrapErr(await useCase.execute(validInput));
    expect(error.message).toContain("fk violation");
  });

  it("surfaces a repository error on the idempotency lookup", async () => {
    const { useCase, client } = setup();
    client.forceErrorOnce("leads", "connection reset");
    const error = unwrapErr(await useCase.execute(validInput));
    expect(error.message).toContain("connection reset");
  });
});
