import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  MarketSignalsRepository,
  MarketSignalsRepositoryError,
} from "./market-signals.repository.js";

const BASE_INSERT = {
  tenant_id: "dss-property",
  vertical: "PROPERTY",
  search_trend_data: { available: false, reason: "circuit breaker terbuka" },
  competitor_data: { available: false, reason: "unconfigured" },
  kpr_rate_data: { available: false, reason: "unconfigured" },
  seasonal_data: { available: true, status: "musim sepi", note: "n" },
  digest_text: "digest",
};

describe("MarketSignalsRepository", () => {
  it("inserts a row, stamping generated_at", async () => {
    const client = createFakeSupabaseClient();
    const repo = new MarketSignalsRepository(client);
    const row = await repo.insert(BASE_INSERT);
    expect(row.tenant_id).toBe("dss-property");
    expect(row.digest_text).toBe("digest");
    expect(typeof row.generated_at).toBe("string");
  });

  it("findLatestByTenant returns undefined when no row exists", async () => {
    const client = createFakeSupabaseClient();
    const repo = new MarketSignalsRepository(client);
    expect(await repo.findLatestByTenant("dss-property")).toBeUndefined();
  });

  it("findLatestByTenant returns the most recently generated row for that tenant", async () => {
    const client = createFakeSupabaseClient();
    client.seed("market_signals", {
      id: "m-1",
      ...BASE_INSERT,
      digest_text: "older",
      generated_at: "2026-01-01T00:00:00.000Z",
    });
    client.seed("market_signals", {
      id: "m-2",
      ...BASE_INSERT,
      digest_text: "newer",
      generated_at: "2026-01-02T00:00:00.000Z",
    });
    client.seed("market_signals", {
      id: "m-3",
      ...BASE_INSERT,
      tenant_id: "other-tenant",
      digest_text: "wrong tenant",
      generated_at: "2026-01-03T00:00:00.000Z",
    });
    const repo = new MarketSignalsRepository(client);
    const latest = await repo.findLatestByTenant("dss-property");
    expect(latest?.digest_text).toBe("newer");
  });

  it("throws MarketSignalsRepositoryError when insert fails", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("market_signals", "boom");
    const repo = new MarketSignalsRepository(client);
    await expect(repo.insert(BASE_INSERT)).rejects.toThrow(MarketSignalsRepositoryError);
  });

  it("throws MarketSignalsRepositoryError when findLatestByTenant fails", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("market_signals", "boom");
    const repo = new MarketSignalsRepository(client);
    await expect(repo.findLatestByTenant("dss-property")).rejects.toThrow(
      MarketSignalsRepositoryError,
    );
  });
});
