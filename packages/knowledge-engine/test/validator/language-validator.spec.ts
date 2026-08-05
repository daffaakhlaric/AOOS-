import { describe, expect, it } from "vitest";

import { LanguageValidator } from "../../src/validator/language-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Validator Test — LanguageValidator", () => {
  it("passes when allowedLanguages is not configured", () => {
    expect(new LanguageValidator().validate({ asset: assetFixture() }).valid).toBe(true);
  });

  it("passes when the Asset's language is in the allow-list", () => {
    const asset = assetFixture();
    const withLanguage = { ...asset, metadata: { ...asset.metadata, language: "en" } };
    const result = new LanguageValidator().validate({
      asset: withLanguage,
      allowedLanguages: ["en", "fr"],
    });
    expect(result.valid).toBe(true);
  });

  it("flags a language not in the allow-list", () => {
    const asset = assetFixture();
    const withLanguage = { ...asset, metadata: { ...asset.metadata, language: "de" } };
    const result = new LanguageValidator().validate({
      asset: withLanguage,
      allowedLanguages: ["en", "fr"],
    });
    expect(result.valid).toBe(false);
  });
});
