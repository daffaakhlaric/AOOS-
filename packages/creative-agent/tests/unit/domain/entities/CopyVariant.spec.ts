import { AdAngle } from "@aos/meta-ads-agent";
import { describe, expect, it } from "vitest";

import {
  CopyVariant,
  HEADLINE_MAX_LENGTH,
  PRIMARY_TEXT_MAX_LENGTH,
} from "../../../../src/domain/entities/CopyVariant.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

function validProps(overrides: Partial<Parameters<typeof CopyVariant.create>[0]> = {}) {
  return {
    id: "id-1",
    variantLabel: "A" as const,
    angle: AdAngle.DP_RINGAN,
    primaryText: "Xpander 2019 ready, DP ringan mulai 29 juta. Yuk tanya sekarang!",
    headline: "DP Ringan Xpander 2019",
    callToAction: "Tanya Sekarang",
    ...overrides,
  };
}

describe("CopyVariant", () => {
  it("pins PRIMARY_TEXT_MAX_LENGTH at 125 (Meta Ads limit)", () => {
    expect(PRIMARY_TEXT_MAX_LENGTH).toBe(125);
  });

  it("pins HEADLINE_MAX_LENGTH at 40 (Meta Ads limit)", () => {
    expect(HEADLINE_MAX_LENGTH).toBe(40);
  });

  it("create() accepts valid props", () => {
    const variant = unwrap(CopyVariant.create(validProps()));
    expect(variant.variantLabel).toBe("A");
    expect(variant.angle).toBe(AdAngle.DP_RINGAN);
    expect(variant.primaryText).toBe(validProps().primaryText);
    expect(variant.headline).toBe(validProps().headline);
    expect(variant.callToAction).toBe("Tanya Sekarang");
    expect(variant.id).toBe("id-1");
  });

  it("create() rejects an empty id", () => {
    expect(unwrapErr(CopyVariant.create(validProps({ id: "" }))).message).toContain("id");
  });

  it("create() rejects an empty primaryText", () => {
    expect(unwrapErr(CopyVariant.create(validProps({ primaryText: "" }))).message).toContain(
      "primaryText",
    );
  });

  it("create() rejects primaryText > 125 chars", () => {
    const error = unwrapErr(CopyVariant.create(validProps({ primaryText: "x".repeat(126) })));
    expect(error.message).toContain("125");
  });

  it("create() accepts primaryText at exactly 125 chars", () => {
    const variant = unwrap(CopyVariant.create(validProps({ primaryText: "x".repeat(125) })));
    expect(variant.primaryText).toHaveLength(125);
  });

  it("create() rejects an empty headline", () => {
    expect(unwrapErr(CopyVariant.create(validProps({ headline: "" }))).message).toContain(
      "headline",
    );
  });

  it("create() rejects headline > 40 chars", () => {
    const error = unwrapErr(CopyVariant.create(validProps({ headline: "x".repeat(41) })));
    expect(error.message).toContain("40");
  });

  it("create() accepts headline at exactly 40 chars", () => {
    const variant = unwrap(CopyVariant.create(validProps({ headline: "x".repeat(40) })));
    expect(variant.headline).toHaveLength(40);
  });

  it("create() rejects an empty callToAction", () => {
    expect(unwrapErr(CopyVariant.create(validProps({ callToAction: "" }))).message).toContain(
      "callToAction",
    );
  });
});
