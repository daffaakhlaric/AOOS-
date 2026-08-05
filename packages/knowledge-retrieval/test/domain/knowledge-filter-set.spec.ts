import {
  KnowledgeAssetType,
  KnowledgeClassification,
  KnowledgeLifecycleState,
} from "@aos/knowledge-engine";
import { describe, expect, it } from "vitest";

import {
  EMPTY_KNOWLEDGE_FILTER_SET,
  knowledgeFilterSetSchema,
} from "../../src/domain/knowledge-filter-set.js";

describe("knowledgeFilterSetSchema", () => {
  it("accepts an empty object", () => {
    expect(knowledgeFilterSetSchema.parse({})).toEqual({});
  });

  it("accepts all 15 fields populated", () => {
    const filters = {
      permission: "read",
      policy: "retention",
      workspaceId: "workspace-1",
      departmentId: "department-1",
      tenantId: "tenant-1",
      classification: KnowledgeClassification.INTERNAL,
      language: "en",
      region: "us",
      categoryId: "category-1",
      tags: ["a", "b"],
      version: "1.0.0",
      templateId: "template-1",
      source: "source-1",
      assetType: KnowledgeAssetType.SUPPORT,
      lifecycleState: KnowledgeLifecycleState.PUBLISHED,
    };
    expect(knowledgeFilterSetSchema.parse(filters)).toEqual(filters);
  });

  it("rejects an unknown classification value", () => {
    expect(() => knowledgeFilterSetSchema.parse({ classification: "bogus" })).toThrow();
  });
});

describe("EMPTY_KNOWLEDGE_FILTER_SET", () => {
  it("is an empty object", () => {
    expect(EMPTY_KNOWLEDGE_FILTER_SET).toEqual({});
  });
});
