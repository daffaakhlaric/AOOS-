import { describe, expect, it } from "vitest";

import { MarkLeadSyncedToMetaAudience } from "../../../src/application/use-cases/MarkLeadSyncedToMetaAudience.js";
import { LeadRepository } from "../../../src/infrastructure/supabase/LeadRepository.js";
import { makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

const FIXED_NOW = new Date("2026-08-21T02:00:00.000Z");

function setup(overrides: Parameters<typeof makeLeadRow>[0] = {}) {
  const client = createFakeSupabaseClient();
  const row = makeLeadRow({ tenant_id: "t1", ...overrides });
  client.seed("leads", [row]);
  const leadRepository = new LeadRepository(client);
  const useCase = new MarkLeadSyncedToMetaAudience(leadRepository, () => FIXED_NOW);
  return { client, useCase, row };
}

describe("MarkLeadSyncedToMetaAudience (AAOS-ABTESTING-LOOKALIKE Part 2)", () => {
  it("sets syncedToMetaAudience=true and syncedAt on a previously-unsynced lead", async () => {
    const { useCase, row } = setup({ synced_to_meta_audience: false, synced_at: null });
    const lead = unwrap(await useCase.execute({ leadId: row.id, tenantId: "t1" }));
    expect(lead.syncedToMetaAudience).toBe(true);
    expect(lead.syncedAt).toEqual(FIXED_NOW);
    expect(lead.updatedAt).toEqual(FIXED_NOW);
  });

  it("returns LeadNotFoundError for an unknown lead id", async () => {
    const { useCase } = setup();
    const error = unwrapErr(
      await useCase.execute({
        leadId: "00000000-0000-0000-0000-000000000000",
        tenantId: "t1",
      }),
    );
    expect(error.message).toContain("not found");
  });

  it("rejects an empty leadId", async () => {
    const { useCase } = setup();
    const error = unwrapErr(await useCase.execute({ leadId: "", tenantId: "t1" }));
    expect(error.message).toContain("LeadId");
  });

  it("returns LeadNotFoundError (not the lead) when queried with a different tenant's id", async () => {
    const { useCase, row } = setup();
    const error = unwrapErr(await useCase.execute({ leadId: row.id, tenantId: "other-tenant" }));
    expect(error.message).toContain("not found");
  });
});
