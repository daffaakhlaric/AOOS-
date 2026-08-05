import { describe, expect, it } from "vitest";

import { VersionValidator } from "../../src/validator/version-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Validator Test — VersionValidator", () => {
  it("passes when the label matches major.minor.patch", () => {
    expect(new VersionValidator().validate({ asset: assetFixture() }).valid).toBe(true);
  });

  it("flags a mismatched label", () => {
    const asset = assetFixture();
    const invalid = { ...asset, version: { ...asset.version, label: "9.9.9" } };
    const result = new VersionValidator().validate({ asset: invalid });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("version.label");
  });
});
