import { describe, expect, it } from "vitest";

import { PropertyAdAngle } from "../../../src/domain/value-objects/PropertyAdAngle.js";
import {
  scorePropertyAdAngleStrength,
  type PropertyListingAngleSignals,
} from "../../../src/intelligence/PropertyAngleStrengthScorer.js";

function buildSignals(
  overrides: Partial<PropertyListingAngleSignals> = {},
): PropertyListingAngleSignals {
  return {
    propertyType: "RUMAH",
    highlights: [],
    photoCount: 0,
    ...overrides,
  };
}

describe("scorePropertyAdAngleStrength", () => {
  it("real bug-class prevention: never returns TESTIMONIAL — this codebase has no per-listing review/testimonial data to honestly score it from", () => {
    const scored = scorePropertyAdAngleStrength(
      buildSignals({ price: 100_000_000, description: "testimonial testimonial testimonial" }),
    );
    expect(scored.some((s) => s.angle === PropertyAdAngle.TESTIMONIAL)).toBe(false);
  });

  it("returns an empty array (never a fabricated score) for a listing with no price, no description, and few photos", () => {
    const scored = scorePropertyAdAngleStrength(buildSignals());
    expect(scored).toEqual([]);
  });

  it("scores DP_RINGAN strongest for a cheap listing, weakest for a premium one — always present whenever price exists", () => {
    const cheap = scorePropertyAdAngleStrength(buildSignals({ price: 400_000_000 }));
    const premium = scorePropertyAdAngleStrength(buildSignals({ price: 3_000_000_000 }));

    const cheapDp = cheap.find((s) => s.angle === PropertyAdAngle.DP_RINGAN);
    const premiumDp = premium.find((s) => s.angle === PropertyAdAngle.DP_RINGAN);
    expect(cheapDp?.strength).toBeGreaterThan(premiumDp?.strength ?? 0);
  });

  it("only includes READY_HUNI when the real condition/description text actually says so", () => {
    const withSignal = scorePropertyAdAngleStrength(buildSignals({ condition: "Baru, siap huni" }));
    const withoutSignal = scorePropertyAdAngleStrength(buildSignals({ price: 500_000_000 }));

    expect(withSignal.some((s) => s.angle === PropertyAdAngle.READY_HUNI)).toBe(true);
    expect(withoutSignal.some((s) => s.angle === PropertyAdAngle.READY_HUNI)).toBe(false);
  });

  it("scores INVESTASI higher from an investable propertyType than from a bare description mention", () => {
    const typeSignal = scorePropertyAdAngleStrength(buildSignals({ propertyType: "RUKO" }));
    const textSignal = scorePropertyAdAngleStrength(
      buildSignals({ propertyType: "RUMAH", description: "cocok untuk investasi jangka panjang" }),
    );

    const typeScore = typeSignal.find((s) => s.angle === PropertyAdAngle.INVESTASI)?.strength ?? 0;
    const textScore = textSignal.find((s) => s.angle === PropertyAdAngle.INVESTASI)?.strength ?? 0;
    expect(typeScore).toBeGreaterThan(textScore);
  });

  it("only includes SYARIAH when the listing's own text explicitly says so — never assumed from propertyType alone", () => {
    const scored = scorePropertyAdAngleStrength(
      buildSignals({ propertyType: "RUKO", price: 1_000_000_000 }),
    );
    expect(scored.some((s) => s.angle === PropertyAdAngle.SYARIAH)).toBe(false);

    const withText = scorePropertyAdAngleStrength(
      buildSignals({ description: "pembiayaan syariah tersedia" }),
    );
    expect(withText.some((s) => s.angle === PropertyAdAngle.SYARIAH)).toBe(true);
  });

  it("only includes VIRTUAL_TOUR once there are enough real photos to cut a walkthrough from", () => {
    const fewPhotos = scorePropertyAdAngleStrength(buildSignals({ photoCount: 2 }));
    const manyPhotos = scorePropertyAdAngleStrength(buildSignals({ photoCount: 8 }));

    expect(fewPhotos.some((s) => s.angle === PropertyAdAngle.VIRTUAL_TOUR)).toBe(false);
    expect(manyPhotos.some((s) => s.angle === PropertyAdAngle.VIRTUAL_TOUR)).toBe(true);
  });

  it("sorts strongest angle first", () => {
    const scored = scorePropertyAdAngleStrength(
      buildSignals({
        price: 300_000_000,
        description: "promo terbatas hanya bulan ini",
        photoCount: 8,
      }),
    );
    for (let i = 1; i < scored.length; i += 1) {
      expect(scored[i - 1]!.strength).toBeGreaterThanOrEqual(scored[i]!.strength);
    }
  });
});
