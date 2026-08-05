import { describe, expect, it } from "vitest";

import { KnowledgeAssetType } from "../../src/domain/knowledge-asset-type.js";
import { KnowledgeClassification } from "../../src/domain/knowledge-classification.js";
import { KnowledgeTemplateCategory } from "../../src/domain/knowledge-template-category.js";
import { TemplateNotFoundException } from "../../src/errors/template-not-found-exception.js";
import { TemplateFactory } from "../../src/factory/template-factory.js";
import { KnowledgeRegistry } from "../../src/registry/knowledge-registry.js";
import { KnowledgeTemplateEngine } from "../../src/template/knowledge-template-engine.js";
import { scopeFixture } from "../helpers/asset-fixture.js";

const templateFactory = new TemplateFactory();

describe("Template Test — KnowledgeTemplateEngine", () => {
  it("register() then get()/list() return the registered Template", () => {
    const engine = new KnowledgeTemplateEngine(new KnowledgeRegistry());
    const template = templateFactory.create({
      name: "FAQ",
      category: KnowledgeTemplateCategory.FAQ,
      assetType: KnowledgeAssetType.FAQ,
    });
    engine.register(template);
    expect(engine.get(template.id)).toBe(template);
    expect(engine.list()).toHaveLength(1);
  });

  it("require() throws TemplateNotFoundException when unregistered", () => {
    const engine = new KnowledgeTemplateEngine(new KnowledgeRegistry());
    expect(() => engine.require("missing")).toThrow(TemplateNotFoundException);
  });

  it("listByCategory() filters by category", () => {
    const engine = new KnowledgeTemplateEngine(new KnowledgeRegistry());
    engine.register(
      templateFactory.create({
        name: "FAQ",
        category: KnowledgeTemplateCategory.FAQ,
        assetType: KnowledgeAssetType.FAQ,
      }),
    );
    engine.register(
      templateFactory.create({
        name: "Sales Script",
        category: KnowledgeTemplateCategory.SALES,
        assetType: KnowledgeAssetType.SALES_SCRIPT,
      }),
    );
    expect(engine.listByCategory(KnowledgeTemplateCategory.FAQ)).toHaveLength(1);
  });

  it("instantiate() builds a Document from the Template's assetType/defaultMetadata/contentTemplate", () => {
    const engine = new KnowledgeTemplateEngine(new KnowledgeRegistry());
    const template = templateFactory.create({
      name: "FAQ",
      category: KnowledgeTemplateCategory.FAQ,
      assetType: KnowledgeAssetType.FAQ,
      contentTemplate: "# {{question}}",
    });
    engine.register(template);
    const document = engine.instantiate(template.id, {
      namespace: "knowledge://t1/w1/l1/faq-1",
      scope: scopeFixture(),
      classification: KnowledgeClassification.PUBLIC,
      ownerId: "user-1",
    });
    expect(document.assetType).toBe(KnowledgeAssetType.FAQ);
    expect(document.templateId).toBe(template.id);
    expect(document.content).toEqual({ template: "# {{question}}" });
  });

  it("instantiate() throws TemplateNotFoundException for an unknown templateId", () => {
    const engine = new KnowledgeTemplateEngine(new KnowledgeRegistry());
    expect(() =>
      engine.instantiate("missing", {
        namespace: "knowledge://t1/w1/l1/d1",
        scope: scopeFixture(),
        classification: KnowledgeClassification.PUBLIC,
        ownerId: "u1",
      }),
    ).toThrow(TemplateNotFoundException);
  });

  it("instantiate() with no contentTemplate leaves content undefined", () => {
    const engine = new KnowledgeTemplateEngine(new KnowledgeRegistry());
    const template = templateFactory.create({
      name: "Manual",
      category: KnowledgeTemplateCategory.PRODUCT,
      assetType: KnowledgeAssetType.MANUAL,
    });
    engine.register(template);
    const document = engine.instantiate(template.id, {
      namespace: "knowledge://t1/w1/l1/manual-1",
      scope: scopeFixture(),
      classification: KnowledgeClassification.INTERNAL,
      ownerId: "u1",
    });
    expect(document.content).toBeUndefined();
  });
});
