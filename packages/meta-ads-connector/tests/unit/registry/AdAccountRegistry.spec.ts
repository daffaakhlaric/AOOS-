import { describe, expect, it } from "vitest";

import { AdBuilder } from "../../../src/builders/AdBuilder.js";
import { AdSetBuilder } from "../../../src/builders/AdSetBuilder.js";
import { CampaignBuilder } from "../../../src/builders/CampaignBuilder.js";
import { AdAccount } from "../../../src/domain/entities/AdAccount.js";
import { AdAccountId } from "../../../src/domain/value-objects/AdAccountId.js";
import { AdAccountRegistry } from "../../../src/registry/AdAccountRegistry.js";
import { unwrap } from "../../helpers/result.js";

function buildAccount() {
  const adAccountId = unwrap(AdAccountId.create("act_752604553578354"));
  const ad = unwrap(new AdBuilder().withMetaId("meta-ad-1").withAdAccountId(adAccountId).build());
  const adSet = unwrap(new AdSetBuilder().withAdAccountId(adAccountId).withAds([ad]).build());
  const campaign = unwrap(
    new CampaignBuilder().withAdAccountId(adAccountId).withAdSets([adSet]).build(),
  );
  const account = unwrap(
    AdAccount.create({
      id: adAccountId,
      name: "Test Account",
      businessManagerId: "bm-1",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      campaigns: [campaign],
      syncedAt: new Date("2026-01-01T00:00:00.000Z"),
    }),
  );
  return { account, adAccountId, ad };
}

describe("AdAccountRegistry", () => {
  it("returns none for an unknown account id", () => {
    const registry = new AdAccountRegistry();
    const found = registry.findById(unwrap(AdAccountId.create("act_999")));
    expect(found.some).toBe(false);
  });

  it("save() then findById() round-trips the AdAccount", () => {
    const registry = new AdAccountRegistry();
    const { account, adAccountId } = buildAccount();
    registry.save(account);
    const found = registry.findById(adAccountId);
    expect(found.some).toBe(true);
    if (found.some) {
      expect(found.value.id.equals(adAccountId)).toBe(true);
    }
  });

  it("save() indexes every ad by its metaId, resolvable via resolveAdByMetaId", () => {
    const registry = new AdAccountRegistry();
    const { account, ad } = buildAccount();
    registry.save(account);
    const resolved = registry.resolveAdByMetaId("meta-ad-1");
    expect(resolved.some).toBe(true);
    if (resolved.some) {
      expect(resolved.value.adId.equals(ad.id)).toBe(true);
    }
  });

  it("resolveAdByMetaId returns none for an unknown metaId", () => {
    const registry = new AdAccountRegistry();
    expect(registry.resolveAdByMetaId("does-not-exist").some).toBe(false);
  });

  it("a second save() for the same account id overwrites the snapshot", () => {
    const registry = new AdAccountRegistry();
    const { account, adAccountId } = buildAccount();
    registry.save(account);
    const updated = account.withCampaigns([]);
    registry.save(updated);
    const found = registry.findById(adAccountId);
    expect(found.some && found.value.campaigns.length).toBe(0);
  });

  it("clear() removes every stored account and ad index entry", () => {
    const registry = new AdAccountRegistry();
    const { account, adAccountId } = buildAccount();
    registry.save(account);
    registry.clear();
    expect(registry.findById(adAccountId).some).toBe(false);
    expect(registry.resolveAdByMetaId("meta-ad-1").some).toBe(false);
  });
});
