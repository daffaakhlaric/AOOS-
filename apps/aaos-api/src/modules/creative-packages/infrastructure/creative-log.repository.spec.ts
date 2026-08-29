import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import { CreativeLogRepository, CreativeLogRepositoryError } from "./creative-log.repository.js";

const TENANT = "dss-motor";
const AT = "2026-08-18T09:41:00.000Z";

describe("CreativeLogRepository.append", () => {
  it("writes a row and returns the domain entry", async () => {
    const client = createFakeSupabaseClient();
    const repo = new CreativeLogRepository(client);
    const entry = await repo.append(
      {
        tenantId: TENANT,
        packageId: "pkg-1",
        fromAgent: "SAMANTHA",
        toAgent: "KAI",
        eventType: "BRIEF_SENT",
        message: "Brief DP_RINGAN untuk Xpander GLS 2022 (CINERE) dikirim ke Kai.",
        brief: { unit: "xpander-gls-2022-001", angle: "DP_RINGAN" },
        adId: "120000000000001",
        stableId: "C047",
      },
      AT,
    );
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(entry.fromAgent).toBe("SAMANTHA");
    expect(entry.toAgent).toBe("KAI");
    expect(entry.eventType).toBe("BRIEF_SENT");
    expect(entry.createdAt).toBe(AT);
    expect(client.rows("creative_logs")).toHaveLength(1);
    expect(client.rows("creative_logs")[0]?.["from_agent"]).toBe("SAMANTHA");
  });

  it("omits absent optional fields rather than surfacing nulls", async () => {
    const client = createFakeSupabaseClient();
    const repo = new CreativeLogRepository(client);
    const entry = await repo.append(
      { tenantId: TENANT, fromAgent: "SYSTEM", eventType: "ERROR", message: "Brief tidak valid" },
      AT,
    );
    expect(entry.packageId).toBeUndefined();
    expect(entry.toAgent).toBeUndefined();
    expect(entry.brief).toBeUndefined();
    expect(entry.result).toBeUndefined();
    expect(entry.error).toBeUndefined();
    expect(entry.metadata).toBeUndefined();
    expect(entry.adId).toBeUndefined();
    expect(entry.stableId).toBeUndefined();
  });

  it("throws CreativeLogRepositoryError on a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("creative_logs", "db down");
    const repo = new CreativeLogRepository(client);
    await expect(
      repo.append({ tenantId: TENANT, fromAgent: "KAI", eventType: "GENERATE", message: "m" }, AT),
    ).rejects.toThrow(CreativeLogRepositoryError);
  });

  it("exposes no update or delete — the log is append-only", () => {
    const repo = new CreativeLogRepository(createFakeSupabaseClient());
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(repo));
    expect(methods).not.toContain("update");
    expect(methods).not.toContain("delete");
  });
});

describe("CreativeLogRepository.list", () => {
  async function seed(): Promise<CreativeLogRepository> {
    const client = createFakeSupabaseClient();
    const repo = new CreativeLogRepository(client);
    await repo.append(
      {
        tenantId: TENANT,
        packageId: "pkg-1",
        fromAgent: "SAMANTHA",
        toAgent: "KAI",
        eventType: "BRIEF_SENT",
        message: "brief",
      },
      "2026-08-18T09:41:00.000Z",
    );
    await repo.append(
      {
        tenantId: TENANT,
        packageId: "pkg-1",
        fromAgent: "KAI",
        toAgent: "KIE_AI",
        eventType: "GENERATE",
        message: "generate",
      },
      "2026-08-18T09:42:00.000Z",
    );
    await repo.append(
      {
        tenantId: TENANT,
        packageId: "pkg-2",
        fromAgent: "MANAGER",
        toAgent: "SISTEM",
        eventType: "APPROVED",
        message: "approve",
      },
      "2026-08-10T10:05:00.000Z",
    );
    await repo.append(
      { tenantId: "other-tenant", fromAgent: "KAI", eventType: "GENERATE", message: "leak?" },
      "2026-08-18T09:43:00.000Z",
    );
    return repo;
  }

  it("returns newest first, tenant-scoped", async () => {
    const repo = await seed();
    const entries = await repo.list({ tenantId: TENANT, limit: 100 });
    expect(entries.map((entry) => entry.message)).toEqual(["generate", "brief", "approve"]);
  });

  it("filters by packageId", async () => {
    const repo = await seed();
    const entries = await repo.list({ tenantId: TENANT, packageId: "pkg-2", limit: 100 });
    expect(entries.map((entry) => entry.message)).toEqual(["approve"]);
  });

  it("filters by eventType", async () => {
    const repo = await seed();
    const entries = await repo.list({ tenantId: TENANT, eventType: "GENERATE", limit: 100 });
    expect(entries.map((entry) => entry.message)).toEqual(["generate"]);
  });

  it("filters by `since` (the period selector)", async () => {
    const repo = await seed();
    const entries = await repo.list({
      tenantId: TENANT,
      since: "2026-08-18T00:00:00.000Z",
      limit: 100,
    });
    expect(entries.map((entry) => entry.message)).toEqual(["generate", "brief"]);
  });

  it("honors the limit", async () => {
    const repo = await seed();
    expect(await repo.list({ tenantId: TENANT, limit: 1 })).toHaveLength(1);
  });

  it("throws on a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("creative_logs", "boom");
    const repo = new CreativeLogRepository(client);
    await expect(repo.list({ tenantId: TENANT, limit: 10 })).rejects.toThrow(
      CreativeLogRepositoryError,
    );
  });
});
