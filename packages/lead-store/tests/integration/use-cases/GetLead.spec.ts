import { describe, expect, it } from "vitest";

import { GetLead } from "../../../src/application/use-cases/GetLead.js";
import { LeadRepository } from "../../../src/infrastructure/supabase/LeadRepository.js";
import { makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("GetLead", () => {
  it("returns the lead when found", async () => {
    const client = createFakeSupabaseClient();
    const row = makeLeadRow();
    client.seed("leads", [row]);
    const useCase = new GetLead(new LeadRepository(client));
    const lead = unwrap(await useCase.execute(row.id));
    expect(lead.id.toString()).toBe(row.id);
  });

  it("returns LeadNotFoundError when missing", async () => {
    const client = createFakeSupabaseClient();
    const useCase = new GetLead(new LeadRepository(client));
    const error = unwrapErr(await useCase.execute("nonexistent"));
    expect(error.message).toContain("not found");
  });

  it("rejects an empty id", async () => {
    const client = createFakeSupabaseClient();
    const useCase = new GetLead(new LeadRepository(client));
    const error = unwrapErr(await useCase.execute(""));
    expect(error.message).toContain("LeadId");
  });

  it("surfaces a repository error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("leads", "connection reset");
    const useCase = new GetLead(new LeadRepository(client));
    const error = unwrapErr(await useCase.execute("some-id"));
    expect(error.message).toContain("connection reset");
  });
});
