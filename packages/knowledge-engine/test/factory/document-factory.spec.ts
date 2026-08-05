import { describe, expect, it } from "vitest";

import { KnowledgeAssetType } from "../../src/domain/knowledge-asset-type.js";
import { KnowledgeClassification } from "../../src/domain/knowledge-classification.js";
import { KnowledgeLifecycleState } from "../../src/domain/knowledge-lifecycle-state.js";
import { DocumentFactory } from "../../src/factory/document-factory.js";

describe("Factory Test — DocumentFactory", () => {
  it("creates a fresh Document in DRAFT with version 1.0.0 and empty Statistics", () => {
    const document = new DocumentFactory().create({
      namespace: "knowledge://t1/w1/l1/d1",
      scope: { tenantId: "t1" },
      classification: KnowledgeClassification.INTERNAL,
      ownerId: "user-1",
    });
    expect(document.lifecycleState).toBe(KnowledgeLifecycleState.DRAFT);
    expect(document.version.label).toBe("1.0.0");
    expect(document.statistics.viewCount).toBe(0);
    expect(document.owner).toEqual({ userId: "user-1", assignedAt: document.createdAt });
    expect(document.assetType).toBe(KnowledgeAssetType.DOCUMENT);
    expect(document.metadata.classification).toBe(KnowledgeClassification.INTERNAL);
  });

  it("defaults tags/labels to independent empty arrays", () => {
    const factory = new DocumentFactory();
    const a = factory.create({
      namespace: "knowledge://t1/w1/l1/a",
      scope: { tenantId: "t1" },
      classification: KnowledgeClassification.PUBLIC,
      ownerId: "u1",
    });
    const b = factory.create({
      namespace: "knowledge://t1/w1/l1/b",
      scope: { tenantId: "t1" },
      classification: KnowledgeClassification.PUBLIC,
      ownerId: "u1",
    });
    expect(a.tags).toEqual([]);
    expect(b.tags).toEqual([]);
    expect(a.tags).not.toBe(b.tags);
  });

  it("accepts a custom assetType/id/content/tags/labels/categoryId/sourceId/templateId", () => {
    const document = new DocumentFactory().create({
      id: "custom-id",
      namespace: "knowledge://t1/w1/l1/faq-1",
      assetType: KnowledgeAssetType.FAQ,
      scope: { tenantId: "t1" },
      classification: KnowledgeClassification.PUBLIC,
      ownerId: "u1",
      content: { answer: "42" },
      contentType: "text/markdown",
      tags: ["tag-1"],
      labels: ["label-1"],
      categoryId: "cat-1",
      sourceId: "src-1",
      templateId: "tmpl-1",
    });
    expect(document.id).toBe("custom-id");
    expect(document.assetType).toBe(KnowledgeAssetType.FAQ);
    expect(document.content).toEqual({ answer: "42" });
    expect(document.contentType).toBe("text/markdown");
    expect(document.tags).toEqual(["tag-1"]);
    expect(document.labels).toEqual(["label-1"]);
    expect(document.categoryId).toBe("cat-1");
    expect(document.sourceId).toBe("src-1");
    expect(document.templateId).toBe("tmpl-1");
  });
});
