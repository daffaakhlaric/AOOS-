import { describe, expect, it } from "vitest";

import { AdBuilder } from "../../../../src/builders/AdBuilder.js";
import { AdSetBuilder } from "../../../../src/builders/AdSetBuilder.js";
import { AdSet } from "../../../../src/domain/entities/AdSet.js";
import { AdStatus } from "../../../../src/domain/value-objects/AdStatus.js";
import { Budget } from "../../../../src/domain/value-objects/Budget.js";
import { StableId } from "../../../../src/domain/value-objects/StableId.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("AdSet", () => {
  it("constructs a valid AdSet via the builder's defaults", () => {
    const adSet = unwrap(new AdSetBuilder().build());
    expect(adSet.name).toBe("Default AdSet");
    expect(adSet.ads).toEqual([]);
  });

  it("rejects an empty name", () => {
    expect(unwrapErr(new AdSetBuilder().withName("").build()).message).toMatch(/name/);
  });

  it("rejects an empty metaId", () => {
    expect(unwrapErr(new AdSetBuilder().withMetaId("").build()).message).toMatch(/metaId/);
  });

  it("rejects an invalid status", () => {
    expect(unwrapErr(new AdSetBuilder().withStatus("BOGUS" as AdStatus).build()).message).toMatch(
      /status/,
    );
  });

  it("defensively copies the ads array on construction (mutating the input array does not affect the entity)", () => {
    const ad = unwrap(new AdBuilder().build());
    const ads = [ad];
    const adSet = unwrap(new AdSetBuilder().withAds(ads).build());
    ads.push(ad);
    expect(adSet.ads.length).toBe(1);
  });

  it("withAds returns a new immutable instance", () => {
    const adSet = unwrap(new AdSetBuilder().build());
    const ad = unwrap(new AdBuilder().build());
    const updated = adSet.withAds([ad]);
    expect(adSet.ads.length).toBe(0);
    expect(updated.ads.length).toBe(1);
    expect(updated).toBeInstanceOf(AdSet);
  });

  it("withStableId returns a new immutable instance", () => {
    const adSet = unwrap(new AdSetBuilder().build());
    const original = adSet.stableId.toString();
    const updated = adSet.withStableId(unwrap(StableId.create("B", 7)));
    expect(adSet.stableId.toString()).toBe(original);
    expect(updated.stableId.toString()).toBe("#B007");
  });

  it("withDailyBudget returns a new immutable instance", () => {
    const adSet = unwrap(new AdSetBuilder().build());
    const newBudget = unwrap(Budget.create(999_999));
    const updated = adSet.withDailyBudget(newBudget);
    expect(updated.dailyBudget.toNumber()).toBe(999_999);
    expect(adSet.dailyBudget.toNumber()).not.toBe(999_999);
  });

  it("exposes every documented getter", () => {
    const adSet = unwrap(new AdSetBuilder().build());
    expect(adSet.id).toBeDefined();
    expect(adSet.campaignId).toBeDefined();
    expect(adSet.adAccountId).toBeDefined();
    expect(adSet.status).toBe(AdStatus.ACTIVE);
    expect(adSet.branch).toBeDefined();
    expect(adSet.spend).toBeDefined();
  });
});
