import { describe, expect, it } from "vitest";

import {
  GenerateCaptionLlmPayloadSchema,
  GenerateCaptionRequestSchema,
} from "./generate-caption.dto.js";

describe("GenerateCaptionRequestSchema", () => {
  const valid = {
    contentType: "PROMO",
    productRef: "Xpander Cross 2019 - Cinere, DP mulai 29 juta",
    angle: "DP Ringan",
    tone: "FRIENDLY",
    vertical: "AUTOMOTIVE",
  };

  it("accepts a well-formed request", () => {
    expect(GenerateCaptionRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts every real contentType/tone/vertical member", () => {
    for (const contentType of ["PROMO", "EDUKASI", "TESTIMONI", "BTS", "TIPS", "MARKET_UPDATE"]) {
      expect(GenerateCaptionRequestSchema.safeParse({ ...valid, contentType }).success).toBe(true);
    }
    for (const tone of ["FRIENDLY", "PROFESSIONAL", "EXCITED", "INFORMATIVE"]) {
      expect(GenerateCaptionRequestSchema.safeParse({ ...valid, tone }).success).toBe(true);
    }
    for (const vertical of ["AUTOMOTIVE", "PROPERTY"]) {
      expect(GenerateCaptionRequestSchema.safeParse({ ...valid, vertical }).success).toBe(true);
    }
  });

  it("rejects an invalid contentType", () => {
    expect(
      GenerateCaptionRequestSchema.safeParse({ ...valid, contentType: "MADE_UP" }).success,
    ).toBe(false);
  });

  it("rejects an invalid tone", () => {
    expect(GenerateCaptionRequestSchema.safeParse({ ...valid, tone: "SAD" }).success).toBe(false);
  });

  it("rejects an invalid vertical", () => {
    expect(GenerateCaptionRequestSchema.safeParse({ ...valid, vertical: "RETAIL" }).success).toBe(
      false,
    );
  });

  it("rejects an empty productRef", () => {
    expect(GenerateCaptionRequestSchema.safeParse({ ...valid, productRef: "" }).success).toBe(
      false,
    );
  });

  it("rejects a missing field", () => {
    const { angle: _angle, ...withoutAngle } = valid;
    expect(GenerateCaptionRequestSchema.safeParse(withoutAngle).success).toBe(false);
  });
});

describe("GenerateCaptionLlmPayloadSchema", () => {
  it("accepts a well-formed two-caption payload", () => {
    const result = GenerateCaptionLlmPayloadSchema.safeParse({
      instagramCaption: "Xpander Cross 2019 DP 29jt aja! Chat sekarang.",
      facebookCaption: "Halo sahabat Mobix! Kabar gembira untuk yang lagi cari mobil keluarga...",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing facebookCaption", () => {
    const result = GenerateCaptionLlmPayloadSchema.safeParse({ instagramCaption: "caption" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty instagramCaption", () => {
    const result = GenerateCaptionLlmPayloadSchema.safeParse({
      instagramCaption: "",
      facebookCaption: "caption",
    });
    expect(result.success).toBe(false);
  });
});
