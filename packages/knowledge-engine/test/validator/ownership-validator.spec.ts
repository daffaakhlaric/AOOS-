import { describe, expect, it } from "vitest";

import { OwnershipValidator } from "../../src/validator/ownership-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Validator Test — OwnershipValidator", () => {
  it("passes for a fresh Owner assignment", () => {
    expect(new OwnershipValidator().validate({ asset: assetFixture() }).valid).toBe(true);
  });

  it("flags a future assignedAt", () => {
    const asset = assetFixture();
    const future = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    const mutated = { ...asset, owner: { ...asset.owner, assignedAt: future } };
    const result = new OwnershipValidator().validate({ asset: mutated });
    expect(result.valid).toBe(false);
  });
});
