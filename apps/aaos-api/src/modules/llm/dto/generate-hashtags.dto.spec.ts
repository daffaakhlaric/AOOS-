import { describe, expect, it } from "vitest";

import {
  GenerateHashtagsLlmPayloadSchema,
  GenerateHashtagsRequestSchema,
} from "./generate-hashtags.dto.js";

describe("GenerateHashtagsRequestSchema", () => {
  const valid = {
    productName: "Xpander Cross 2019",
    brand: "MobixCinere",
    location: "Cinere",
    vertical: "AUTOMOTIVE",
  };

  it("accepts a well-formed request", () => {
    expect(GenerateHashtagsRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts PROPERTY vertical", () => {
    expect(
      GenerateHashtagsRequestSchema.safeParse({ ...valid, vertical: "PROPERTY" }).success,
    ).toBe(true);
  });

  it("rejects an invalid vertical", () => {
    expect(GenerateHashtagsRequestSchema.safeParse({ ...valid, vertical: "RETAIL" }).success).toBe(
      false,
    );
  });

  it("rejects an empty productName", () => {
    expect(GenerateHashtagsRequestSchema.safeParse({ ...valid, productName: "" }).success).toBe(
      false,
    );
  });

  it("rejects a missing brand", () => {
    const { brand: _brand, ...withoutBrand } = valid;
    expect(GenerateHashtagsRequestSchema.safeParse(withoutBrand).success).toBe(false);
  });
});

describe("GenerateHashtagsLlmPayloadSchema", () => {
  const eightTags = Array.from({ length: 8 }, (_unused, i) => `#Tag${String(i)}`);

  it("accepts exactly 8 well-formed hashtags", () => {
    expect(GenerateHashtagsLlmPayloadSchema.safeParse({ hashtags: eightTags }).success).toBe(true);
  });

  it("accepts exactly 12 well-formed hashtags", () => {
    const twelveTags = Array.from({ length: 12 }, (_unused, i) => `#Tag${String(i)}`);
    expect(GenerateHashtagsLlmPayloadSchema.safeParse({ hashtags: twelveTags }).success).toBe(true);
  });

  it("rejects fewer than 8 hashtags (fail closed)", () => {
    const sevenTags = eightTags.slice(0, 7);
    expect(GenerateHashtagsLlmPayloadSchema.safeParse({ hashtags: sevenTags }).success).toBe(false);
  });

  it("rejects more than 12 hashtags (fail closed)", () => {
    const thirteenTags = Array.from({ length: 13 }, (_unused, i) => `#Tag${String(i)}`);
    expect(GenerateHashtagsLlmPayloadSchema.safeParse({ hashtags: thirteenTags }).success).toBe(
      false,
    );
  });

  it("rejects a hashtag missing the # prefix", () => {
    const badTags = [...eightTags.slice(0, 7), "NoHash"];
    expect(GenerateHashtagsLlmPayloadSchema.safeParse({ hashtags: badTags }).success).toBe(false);
  });

  it("rejects a hashtag containing whitespace", () => {
    const badTags = [...eightTags.slice(0, 7), "#Has Space"];
    expect(GenerateHashtagsLlmPayloadSchema.safeParse({ hashtags: badTags }).success).toBe(false);
  });
});
