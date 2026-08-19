import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import { SalesHumanRepository, SalesHumanRepositoryError } from "./sales-human.repository.js";

describe("SalesHumanRepository", () => {
  it("inserts a row and returns it (including the DB-generated id)", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SalesHumanRepository(client);
    const row = await repo.insert({
      tenant_id: "dss-motor",
      name: "Ahmad Fauzi",
      wa_number: "+62812000001",
      branch_id: "BINTARO",
      status: "ON",
      max_leads_per_day: 10,
      auth_user_id: "auth-1",
    });
    expect(row.name).toBe("Ahmad Fauzi");
    expect(row.auth_user_id).toBe("auth-1");
  });

  it("findById returns undefined for a missing row", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SalesHumanRepository(client);
    const found = await repo.findById("missing-id");
    expect(found).toBeUndefined();
  });

  it("findById returns the seeded row", async () => {
    const client = createFakeSupabaseClient();
    client.seed("sales_humans", {
      id: "sh-1",
      tenant_id: "dss-motor",
      name: "Budi",
      wa_number: "+62812000002",
      branch_id: "CINERE",
      status: "ON",
      max_leads_per_day: 10,
      auth_user_id: "auth-2",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const repo = new SalesHumanRepository(client);
    const found = await repo.findById("sh-1");
    expect(found?.name).toBe("Budi");
  });

  it("updateById patches the row in place", async () => {
    const client = createFakeSupabaseClient();
    client.seed("sales_humans", {
      id: "sh-1",
      tenant_id: "dss-motor",
      name: "Budi",
      wa_number: "+62812000002",
      branch_id: "CINERE",
      status: "ON",
      max_leads_per_day: 10,
      auth_user_id: "auth-2",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const repo = new SalesHumanRepository(client);
    const updated = await repo.updateById("sh-1", { status: "OFF" });
    expect(updated.status).toBe("OFF");
  });

  it("list filters by tenant and optionally branch", async () => {
    const client = createFakeSupabaseClient();
    client.seed("sales_humans", {
      id: "sh-1",
      tenant_id: "dss-motor",
      name: "Budi",
      wa_number: "1",
      branch_id: "CINERE",
      status: "ON",
      max_leads_per_day: 10,
      auth_user_id: "a1",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    client.seed("sales_humans", {
      id: "sh-2",
      tenant_id: "dss-motor",
      name: "Ahmad",
      wa_number: "2",
      branch_id: "BINTARO",
      status: "ON",
      max_leads_per_day: 10,
      auth_user_id: "a2",
      created_at: "2026-01-02T00:00:00.000Z",
    });
    const repo = new SalesHumanRepository(client);
    const all = await repo.list("dss-motor");
    expect(all).toHaveLength(2);
    const bintaro = await repo.list("dss-motor", "BINTARO");
    expect(bintaro).toHaveLength(1);
    expect(bintaro[0]?.name).toBe("Ahmad");
  });

  it("throws SalesHumanRepositoryError on a forced Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("sales_humans", "boom");
    const repo = new SalesHumanRepository(client);
    await expect(repo.list("dss-motor")).rejects.toThrow(SalesHumanRepositoryError);
  });
});
