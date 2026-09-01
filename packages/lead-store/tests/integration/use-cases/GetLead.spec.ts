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
    const lead = unwrap(await useCase.execute(row.id, "dss-motor"));
    expect(lead.id.toString()).toBe(row.id);
  });

  it("returns LeadNotFoundError when missing", async () => {
    const client = createFakeSupabaseClient();
    const useCase = new GetLead(new LeadRepository(client));
    const error = unwrapErr(await useCase.execute("nonexistent", "dss-motor"));
    expect(error.message).toContain("not found");
  });

  it("rejects an empty id", async () => {
    const client = createFakeSupabaseClient();
    const useCase = new GetLead(new LeadRepository(client));
    const error = unwrapErr(await useCase.execute("", "dss-motor"));
    expect(error.message).toContain("LeadId");
  });

  it("surfaces a repository error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("leads", "connection reset");
    const useCase = new GetLead(new LeadRepository(client));
    const error = unwrapErr(await useCase.execute("some-id", "dss-motor"));
    expect(error.message).toContain("connection reset");
  });

  /** PROPERTY-TENANT-ISOLATION Phase 1 — use-case-level regression test mirroring `LeadRepository.spec.ts`'s repository-level one: a real, currently-CLOSED-off IDOR would otherwise let tenant B fetch tenant A's lead by UUID alone. */
  it("returns LeadNotFoundError (not the lead) when queried with a different tenant's id", async () => {
    const client = createFakeSupabaseClient();
    const row = makeLeadRow({ tenant_id: "tenant-a" });
    client.seed("leads", [row]);
    const useCase = new GetLead(new LeadRepository(client));
    const error = unwrapErr(await useCase.execute(row.id, "tenant-b"));
    expect(error.message).toContain("not found");
  });
});
