import { AdAccountId, AdSetId, CampaignId, type AdAccount } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  AdTenantIndexRepository,
  AdTenantIndexRepositoryError,
  indexPulledAdAccount,
} from "./ad-tenant-index.repository.js";

function seedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ad_meta_id: "ad-meta-1",
    tenant_id: "dss-motor",
    ad_account_id: "act_752604553578354",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("AdTenantIndexRepository", () => {
  describe("upsertMany", () => {
    it("inserts new rows for previously-unindexed ad ids", async () => {
      const client = createFakeSupabaseClient();
      const repo = new AdTenantIndexRepository(client);
      await repo.upsertMany([
        { adMetaId: "ad-1", tenantId: "dss-motor", adAccountId: "act_1" },
        { adMetaId: "ad-2", tenantId: "dss-motor", adAccountId: "act_1" },
      ]);
      expect(await repo.findTenantByAdMetaId("ad-1")).toBe("dss-motor");
      expect(await repo.findTenantByAdMetaId("ad-2")).toBe("dss-motor");
    });

    it("is idempotent — re-running upsertMany for the same ad_meta_id refreshes rather than duplicates", async () => {
      const client = createFakeSupabaseClient();
      client.seed("ad_tenant_index", seedRow());
      const repo = new AdTenantIndexRepository(client);
      await repo.upsertMany([
        { adMetaId: "ad-meta-1", tenantId: "other-tenant", adAccountId: "act_new" },
      ]);
      expect(client.rows("ad_tenant_index")).toHaveLength(1);
      expect(await repo.findTenantByAdMetaId("ad-meta-1")).toBe("other-tenant");
    });

    it("is a no-op for an empty entries array", async () => {
      const client = createFakeSupabaseClient();
      const repo = new AdTenantIndexRepository(client);
      await repo.upsertMany([]);
      expect(client.rows("ad_tenant_index")).toHaveLength(0);
    });

    it("throws AdTenantIndexRepositoryError on a forced Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("ad_tenant_index", "boom");
      const repo = new AdTenantIndexRepository(client);
      await expect(
        repo.upsertMany([{ adMetaId: "ad-1", tenantId: "dss-motor", adAccountId: "act_1" }]),
      ).rejects.toThrow(AdTenantIndexRepositoryError);
    });
  });

  describe("findTenantByAdMetaId", () => {
    it("returns the matching row's tenant_id", async () => {
      const client = createFakeSupabaseClient();
      client.seed("ad_tenant_index", seedRow());
      const repo = new AdTenantIndexRepository(client);
      expect(await repo.findTenantByAdMetaId("ad-meta-1")).toBe("dss-motor");
    });

    it("returns undefined for an unindexed ad_meta_id", async () => {
      const client = createFakeSupabaseClient();
      const repo = new AdTenantIndexRepository(client);
      expect(await repo.findTenantByAdMetaId("unknown-ad")).toBeUndefined();
    });

    it("throws AdTenantIndexRepositoryError on a forced Supabase error", async () => {
      const client = createFakeSupabaseClient();
      client.forceErrorOnce("ad_tenant_index", "boom");
      const repo = new AdTenantIndexRepository(client);
      await expect(repo.findTenantByAdMetaId("ad-1")).rejects.toThrow(AdTenantIndexRepositoryError);
    });
  });
});

describe("indexPulledAdAccount", () => {
  it("upserts one entry per real ad walked from campaigns[].adSets[].ads[]", async () => {
    const client = createFakeSupabaseClient();
    const repo = new AdTenantIndexRepository(client);
    const adAccount = buildFakeAdAccount(["meta-ad-a", "meta-ad-b"]);

    await indexPulledAdAccount(repo, "dss-motor", adAccount);

    expect(await repo.findTenantByAdMetaId("meta-ad-a")).toBe("dss-motor");
    expect(await repo.findTenantByAdMetaId("meta-ad-b")).toBe("dss-motor");
  });

  it("never throws when the underlying upsert fails — logs and continues", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("ad_tenant_index", "boom");
    const repo = new AdTenantIndexRepository(client);
    const adAccount = buildFakeAdAccount(["meta-ad-a"]);

    await expect(indexPulledAdAccount(repo, "dss-motor", adAccount)).resolves.toBeUndefined();
  });

  it("is a no-op (never throws) for an AdAccount with zero ads", async () => {
    const client = createFakeSupabaseClient();
    const repo = new AdTenantIndexRepository(client);
    const adAccount = buildFakeAdAccount([]);

    await expect(indexPulledAdAccount(repo, "dss-motor", adAccount)).resolves.toBeUndefined();
    expect(client.rows("ad_tenant_index")).toHaveLength(0);
  });
});

/**
 * A minimal, structurally-real `AdAccount` for exercising `indexPulledAdAccount`'s walk —
 * campaigns[].adSets[].ads[], the exact shape `AdAccountRegistry.save` already walks. Only the
 * fields `indexPulledAdAccount` reads (`adAccount.id`, `campaign.adSets[].ads[].metaId`) are real;
 * everything else is a minimal stand-in cast through `unknown`, same as this repo's other
 * hand-rolled domain-entity test doubles.
 */
function buildFakeAdAccount(adMetaIds: readonly string[]): AdAccount {
  const adAccountIdResult = AdAccountId.create("act_752604553578354");
  if (!adAccountIdResult.ok) {
    throw new Error("test setup failed: AdAccountId.create");
  }
  const ads = adMetaIds.map((metaId) => ({ metaId }));
  return {
    id: adAccountIdResult.value,
    campaigns: [
      {
        id: CampaignId.generate(),
        adSets: [{ id: AdSetId.generate(), ads }],
      },
    ],
  } as unknown as AdAccount;
}
