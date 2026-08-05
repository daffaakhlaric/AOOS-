import { describe, expect, it } from "vitest";

import { MetadataValidator } from "../../src/validator/metadata-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Validator Test — MetadataValidator", () => {
  it("passes for a freshly-created Asset", () => {
    expect(new MetadataValidator().validate({ asset: assetFixture() }).valid).toBe(true);
  });

  it("flags reviewedAt preceding createdAt", () => {
    const asset = assetFixture();
    const invalid = {
      ...asset,
      metadata: { ...asset.metadata, reviewedAt: "2000-01-01T00:00:00.000Z" },
    };
    const result = new MetadataValidator().validate({ asset: invalid });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("metadata.reviewedAt");
  });

  it("flags expiresAt preceding createdAt", () => {
    const asset = assetFixture();
    const invalid = {
      ...asset,
      metadata: { ...asset.metadata, expiresAt: "2000-01-01T00:00:00.000Z" },
    };
    const result = new MetadataValidator().validate({ asset: invalid });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("metadata.expiresAt");
  });
});
