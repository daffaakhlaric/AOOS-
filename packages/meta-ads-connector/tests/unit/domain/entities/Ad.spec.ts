import { describe, expect, it } from "vitest";

import { AdBuilder } from "../../../../src/builders/AdBuilder.js";
import { Ad } from "../../../../src/domain/entities/Ad.js";
import { AdStatus } from "../../../../src/domain/value-objects/AdStatus.js";
import { StableId } from "../../../../src/domain/value-objects/StableId.js";
import { Verdict } from "../../../../src/domain/value-objects/Verdict.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("Ad", () => {
  it("constructs a valid Ad via the builder's defaults", () => {
    const ad = unwrap(new AdBuilder().build());
    expect(ad.name).toBe("Default Ad");
    expect(ad.status).toBe(AdStatus.ACTIVE);
  });

  it("rejects an empty name", () => {
    expect(unwrapErr(new AdBuilder().withName("").build()).message).toMatch(/name/);
  });

  it("rejects a whitespace-only name", () => {
    expect(new AdBuilder().withName("   ").build().ok).toBe(false);
  });

  it("rejects an empty metaId", () => {
    expect(unwrapErr(new AdBuilder().withMetaId("").build()).message).toMatch(/metaId/);
  });

  it("rejects an invalid status", () => {
    expect(unwrapErr(new AdBuilder().withStatus("BOGUS" as AdStatus).build()).message).toMatch(
      /status/,
    );
  });

  it("rejects an invalid verdict", () => {
    expect(unwrapErr(new AdBuilder().withVerdict("BOGUS" as Verdict).build()).message).toMatch(
      /verdict/,
    );
  });

  it("rejects a negative daysSinceCreation", () => {
    expect(new AdBuilder().withDaysSinceCreation(-1).build().ok).toBe(false);
  });

  it("rejects a non-finite daysSinceCreation", () => {
    expect(new AdBuilder().withDaysSinceCreation(NaN).build().ok).toBe(false);
  });

  it("accepts daysSinceCreation of exactly 0", () => {
    expect(new AdBuilder().withDaysSinceCreation(0).build().ok).toBe(true);
  });

  it("withVerdict returns a new immutable instance, leaving the original unchanged", () => {
    const ad = unwrap(new AdBuilder().withVerdict(Verdict.KEEP).build());
    const updated = ad.withVerdict(Verdict.PAUSE);
    expect(ad.verdict).toBe(Verdict.KEEP);
    expect(updated.verdict).toBe(Verdict.PAUSE);
    expect(updated).not.toBe(ad);
    expect(updated).toBeInstanceOf(Ad);
  });

  it("withStableId returns a new immutable instance, leaving the original unchanged", () => {
    const ad = unwrap(new AdBuilder().build());
    const original = ad.stableId.toString();
    const withNewId = ad.withStableId(unwrap(StableId.create("C", 5)));
    expect(ad.stableId.toString()).toBe(original);
    expect(withNewId.stableId.toString()).toBe("#C005");
  });

  it("exposes every documented getter", () => {
    const ad = unwrap(new AdBuilder().build());
    expect(ad.id).toBeDefined();
    expect(ad.stableId).toBeDefined();
    expect(ad.metaId).toBe("120000000000003");
    expect(ad.adSetId).toBeDefined();
    expect(ad.campaignId).toBeDefined();
    expect(ad.adAccountId).toBeDefined();
    expect(ad.funnel).toBeDefined();
    expect(ad.branch).toBeDefined();
    expect(ad.metrics).toBeDefined();
    expect(ad.createdAt).toBeInstanceOf(Date);
  });
});
