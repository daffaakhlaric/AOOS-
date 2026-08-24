import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  IntelligenceSignalsRepository,
  IntelligenceSignalsRepositoryError,
} from "./intelligence-signals.repository.js";

const BASE_INSERT = {
  tenant_id: "dss-motor",
  branch_id: null,
  seasonal_data: { isSpecialPeriod: false },
  trends_data: { available: false },
  competitor_data: { available: false },
  inventory_data: { available: false },
  lead_profile_data: { totalLeads: 0 },
  closing_data: { totalEvents: 0 },
  campaign_strategy: { available: false, reason: "NO_API_KEY", message: "x" },
  digest_text: "digest",
};

describe("IntelligenceSignalsRepository", () => {
  it("inserts a row, stamping generated_at", async () => {
    const client = createFakeSupabaseClient();
    const repo = new IntelligenceSignalsRepository(client);
    const row = await repo.insert(BASE_INSERT);
    expect(row.tenant_id).toBe("dss-motor");
    expect(row.digest_text).toBe("digest");
    expect(typeof row.generated_at).toBe("string");
  });

  it("findLatestByTenant returns undefined when no row exists", async () => {
    const client = createFakeSupabaseClient();
    const repo = new IntelligenceSignalsRepository(client);
    expect(await repo.findLatestByTenant("dss-motor")).toBeUndefined();
  });

  it("findLatestByTenant returns the most recently generated row for that tenant", async () => {
    const client = createFakeSupabaseClient();
    client.seed("intelligence_signals", {
      id: "s-1",
      ...BASE_INSERT,
      digest_text: "older",
      generated_at: "2026-01-01T00:00:00.000Z",
    });
    client.seed("intelligence_signals", {
      id: "s-2",
      ...BASE_INSERT,
      digest_text: "newer",
      generated_at: "2026-01-02T00:00:00.000Z",
    });
    client.seed("intelligence_signals", {
      id: "s-3",
      ...BASE_INSERT,
      tenant_id: "other-tenant",
      digest_text: "wrong tenant",
      generated_at: "2026-01-03T00:00:00.000Z",
    });
    const repo = new IntelligenceSignalsRepository(client);
    const latest = await repo.findLatestByTenant("dss-motor");
    expect(latest?.digest_text).toBe("newer");
  });

  it("throws IntelligenceSignalsRepositoryError when insert fails", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("intelligence_signals", "boom");
    const repo = new IntelligenceSignalsRepository(client);
    await expect(repo.insert(BASE_INSERT)).rejects.toThrow(IntelligenceSignalsRepositoryError);
  });

  it("throws IntelligenceSignalsRepositoryError when findLatestByTenant fails", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("intelligence_signals", "boom");
    const repo = new IntelligenceSignalsRepository(client);
    await expect(repo.findLatestByTenant("dss-motor")).rejects.toThrow(
      IntelligenceSignalsRepositoryError,
    );
  });
});
