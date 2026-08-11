import {
  AdAccountId,
  AdAccountRegistry,
  CampaignBuilder,
  Spend,
  StableId,
  type AdAccount,
} from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { MetaAdsSpendAdapter } from "../../../src/infrastructure/adapters/MetaAdsSpendAdapter.js";
import { unwrap } from "../../helpers/result.js";

describe("MetaAdsSpendAdapter", () => {
  it("returns 0 for every campaign id when the registry has no matching account", async () => {
    const registry = new AdAccountRegistry();
    const adAccountId = unwrap(AdAccountId.create("act_1"));
    const adapter = new MetaAdsSpendAdapter(registry, [adAccountId]);
    const result = await adapter.getSpendByCampaign(["#C047"]);
    expect(result.get("#C047")).toBe(0);
  });

  it("returns 0 for every campaign id when no ad account ids are configured", async () => {
    const registry = new AdAccountRegistry();
    const adapter = new MetaAdsSpendAdapter(registry, []);
    const result = await adapter.getSpendByCampaign(["#C047", "#C099"]);
    expect(result.get("#C047")).toBe(0);
    expect(result.get("#C099")).toBe(0);
  });

  it("returns an empty map when no campaign ids are requested", async () => {
    const registry = new AdAccountRegistry();
    const adapter = new MetaAdsSpendAdapter(registry, []);
    const result = await adapter.getSpendByCampaign([]);
    expect(result.size).toBe(0);
  });

  it("resolves real spend by stableId (the #C047-style id used in closings.campaign_id)", async () => {
    const registry = new AdAccountRegistry();
    const adAccountId = unwrap(AdAccountId.create("act_752604553578354"));
    const stableId = unwrap(StableId.create("C", 47));
    const campaign = unwrap(
      new CampaignBuilder()
        .withAdAccountId(adAccountId)
        .withStableId(stableId)
        .withSpend(unwrap(Spend.create(564_000)))
        .build(),
    );
    // `AdAccount` is exported type-only from @aos/meta-ads-connector (no public constructor/builder
    // outside the package) — a duck-typed object satisfying the fields `AdAccountRegistry.save`
    // and `MetaAdsSpendAdapter` actually read (`id`, `campaigns`) is the only way to seed the
    // registry from this package's tests without a real Meta API sync.
    const account = { id: adAccountId, campaigns: [campaign] } as unknown as AdAccount;
    registry.save(account);

    const adapter = new MetaAdsSpendAdapter(registry, [adAccountId]);
    const result = await adapter.getSpendByCampaign([stableId.toString()]);
    expect(result.get(stableId.toString())).toBe(564_000);
  });

  it("also resolves real spend by the raw Meta metaId", async () => {
    const registry = new AdAccountRegistry();
    const adAccountId = unwrap(AdAccountId.create("act_752604553578354"));
    const campaign = unwrap(
      new CampaignBuilder()
        .withAdAccountId(adAccountId)
        .withMetaId("120000000009999")
        .withSpend(unwrap(Spend.create(100_000)))
        .build(),
    );
    const account = { id: adAccountId, campaigns: [campaign] } as unknown as AdAccount;
    registry.save(account);

    const adapter = new MetaAdsSpendAdapter(registry, [adAccountId]);
    const result = await adapter.getSpendByCampaign(["120000000009999"]);
    expect(result.get("120000000009999")).toBe(100_000);
  });
});
