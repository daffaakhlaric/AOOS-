import { AdAngle } from "@aos/meta-ads-agent";
import { describe, expect, it } from "vitest";

import { CopyVariantBuilder } from "../../../src/builders/CopyVariantBuilder.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("CopyVariantBuilder", () => {
  it("build() generates a UUID id and delegates to CopyVariant.create", () => {
    const variant = unwrap(
      CopyVariantBuilder.build({
        variantLabel: "A",
        angle: AdAngle.DP_RINGAN,
        primaryText: "sample text",
        headline: "sample headline",
        callToAction: "Tanya Sekarang",
      }),
    );
    expect(variant.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(variant.variantLabel).toBe("A");
  });

  it("build() propagates CopyVariant.create's validation failure", () => {
    const error = unwrapErr(
      CopyVariantBuilder.build({
        variantLabel: "B",
        angle: AdAngle.DP_RINGAN,
        primaryText: "",
        headline: "sample headline",
        callToAction: "Tanya Sekarang",
      }),
    );
    expect(error.message).toContain("primaryText");
  });
});
