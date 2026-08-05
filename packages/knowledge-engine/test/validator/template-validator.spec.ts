import { describe, expect, it } from "vitest";

import { KnowledgeAssetType } from "../../src/domain/knowledge-asset-type.js";
import { KnowledgeTemplateCategory } from "../../src/domain/knowledge-template-category.js";
import { TemplateValidator } from "../../src/validator/template-validator.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Validator Test — TemplateValidator", () => {
  it("passes when no template is supplied", () => {
    expect(new TemplateValidator().validate({ asset: assetFixture() }).valid).toBe(true);
  });

  it("passes when the Asset's assetType matches the Template it was instantiated from", () => {
    const template = {
      id: "tmpl-1",
      name: "x",
      category: KnowledgeTemplateCategory.FAQ,
      assetType: KnowledgeAssetType.DOCUMENT,
      version: "1.0.0",
      createdAt: new Date().toISOString(),
    };
    const asset = { ...assetFixture(), templateId: template.id };
    const result = new TemplateValidator().validate({ asset, template });
    expect(result.valid).toBe(true);
  });

  it("flags a mismatch between the Asset's assetType and the Template's assetType", () => {
    const template = {
      id: "tmpl-1",
      name: "x",
      category: KnowledgeTemplateCategory.FAQ,
      assetType: KnowledgeAssetType.FAQ,
      version: "1.0.0",
      createdAt: new Date().toISOString(),
    };
    const asset = { ...assetFixture(), templateId: template.id };
    const result = new TemplateValidator().validate({ asset, template });
    expect(result.valid).toBe(false);
  });
});
