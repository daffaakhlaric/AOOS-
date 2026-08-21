import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  BroadcastTemplateRepository,
  BroadcastTemplateRepositoryError,
} from "./broadcast-template.repository.js";

describe("BroadcastTemplateRepository", () => {
  it("inserts a row, defaulting reply_rate/hot_rate/sent_count to 0", async () => {
    const client = createFakeSupabaseClient();
    const repo = new BroadcastTemplateRepository(client);
    const row = await repo.insert({
      tenant_id: "dss-motor",
      name: "Promo DP Ringan",
      content: "Halo {nama}!",
      target_statuses: ["WARM", "COLD"],
      cooldown_days: 3,
      status: "ACTIVE",
    });
    expect(row.name).toBe("Promo DP Ringan");
    expect(row.reply_rate).toBe(0);
    expect(row.hot_rate).toBe(0);
    expect(row.sent_count).toBe(0);
  });

  it("findById returns undefined for a missing template", async () => {
    const client = createFakeSupabaseClient();
    const repo = new BroadcastTemplateRepository(client);
    expect(await repo.findById("missing")).toBeUndefined();
  });

  it("listByTenant returns only that tenant's templates", async () => {
    const client = createFakeSupabaseClient();
    client.seed("broadcast_templates", {
      id: "t-1",
      tenant_id: "dss-motor",
      name: "A",
      content: "x",
      target_statuses: ["WARM"],
      cooldown_days: 3,
      status: "ACTIVE",
      reply_rate: 0,
      hot_rate: 0,
      sent_count: 0,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    client.seed("broadcast_templates", {
      id: "t-2",
      tenant_id: "other-tenant",
      name: "B",
      content: "y",
      target_statuses: ["COLD"],
      cooldown_days: 5,
      status: "ACTIVE",
      reply_rate: 0,
      hot_rate: 0,
      sent_count: 0,
      created_at: "2026-01-02T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    });
    const repo = new BroadcastTemplateRepository(client);
    const rows = await repo.listByTenant("dss-motor");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("A");
  });

  it("update patches the row and bumps updated_at", async () => {
    const client = createFakeSupabaseClient();
    client.seed("broadcast_templates", {
      id: "t-1",
      tenant_id: "dss-motor",
      name: "A",
      content: "x",
      target_statuses: ["WARM"],
      cooldown_days: 3,
      status: "ACTIVE",
      reply_rate: 0,
      hot_rate: 0,
      sent_count: 0,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const repo = new BroadcastTemplateRepository(client);
    const updated = await repo.update("t-1", { status: "INACTIVE" });
    expect(updated.status).toBe("INACTIVE");
  });

  it("incrementSentCount is a no-op for a missing template", async () => {
    const client = createFakeSupabaseClient();
    const repo = new BroadcastTemplateRepository(client);
    await expect(repo.incrementSentCount("missing")).resolves.toBeUndefined();
  });

  it("incrementSentCount bumps sent_count by 1", async () => {
    const client = createFakeSupabaseClient();
    client.seed("broadcast_templates", {
      id: "t-1",
      tenant_id: "dss-motor",
      name: "A",
      content: "x",
      target_statuses: ["WARM"],
      cooldown_days: 3,
      status: "ACTIVE",
      reply_rate: 0,
      hot_rate: 0,
      sent_count: 4,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const repo = new BroadcastTemplateRepository(client);
    await repo.incrementSentCount("t-1");
    const found = await repo.findById("t-1");
    expect(found?.sent_count).toBe(5);
  });

  it("throws BroadcastTemplateRepositoryError on a forced Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("broadcast_templates", "boom");
    const repo = new BroadcastTemplateRepository(client);
    await expect(repo.listByTenant("dss-motor")).rejects.toThrow(BroadcastTemplateRepositoryError);
  });
});
