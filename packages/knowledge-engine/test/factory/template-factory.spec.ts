import { describe, expect, it } from "vitest";

import { KnowledgeAssetType } from "../../src/domain/knowledge-asset-type.js";
import { KnowledgeTemplateCategory } from "../../src/domain/knowledge-template-category.js";
import { TemplateFactory } from "../../src/factory/template-factory.js";

describe("Factory Test — TemplateFactory", () => {
  it("defaults version to 1.0.0", () => {
    const template = new TemplateFactory().create({
      name: "FAQ Template",
      category: KnowledgeTemplateCategory.FAQ,
      assetType: KnowledgeAssetType.FAQ,
    });
    expect(template.version).toBe("1.0.0");
    expect(template.id).toEqual(expect.any(String));
  });

  it("accepts a custom version/defaultMetadata/contentTemplate", () => {
    const template = new TemplateFactory().create({
      name: "Playbook",
      category: KnowledgeTemplateCategory.PLAYBOOK,
      assetType: KnowledgeAssetType.PLAYBOOK,
      version: "2.0.0",
      defaultMetadata: { language: "en" },
      contentTemplate: "# {{title}}",
    });
    expect(template.version).toBe("2.0.0");
    expect(template.defaultMetadata).toEqual({ language: "en" });
    expect(template.contentTemplate).toBe("# {{title}}");
  });
});
