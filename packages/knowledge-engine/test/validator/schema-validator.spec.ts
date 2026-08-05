import { describe, expect, it } from "vitest";

import { KnowledgeAssetType } from "../../src/domain/knowledge-asset-type.js";
import { SchemaValidator } from "../../src/validator/schema-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Validator Test — SchemaValidator", () => {
  it("passes when no schema is supplied", () => {
    expect(new SchemaValidator().validate({ asset: assetFixture() }).valid).toBe(true);
  });

  it("passes when every required field is present in content", () => {
    const asset = assetFixture({ content: { title: "Hello" } });
    const result = new SchemaValidator().validate({
      asset,
      schema: {
        id: "s-1",
        name: "Doc",
        assetType: KnowledgeAssetType.DOCUMENT,
        version: "1.0.0",
        fields: { title: "string" },
        requiredFields: ["title"],
      },
    });
    expect(result.valid).toBe(true);
  });

  it("flags a missing required field", () => {
    const asset = assetFixture({ content: {} });
    const result = new SchemaValidator().validate({
      asset,
      schema: {
        id: "s-1",
        name: "Doc",
        assetType: KnowledgeAssetType.DOCUMENT,
        version: "1.0.0",
        fields: { title: "string" },
        requiredFields: ["title"],
      },
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("content.title");
  });
});
