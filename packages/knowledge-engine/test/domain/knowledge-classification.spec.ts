import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_CLASSIFICATION_RANK,
  KnowledgeClassification,
} from "../../src/domain/knowledge-classification.js";

describe("Domain Test — KnowledgeClassification", () => {
  it("ranks every classification value from least to most sensitive", () => {
    expect(KNOWLEDGE_CLASSIFICATION_RANK[KnowledgeClassification.PUBLIC]).toBe(0);
    expect(KNOWLEDGE_CLASSIFICATION_RANK[KnowledgeClassification.HIGHLY_CONFIDENTIAL]).toBe(5);
    expect(KNOWLEDGE_CLASSIFICATION_RANK[KnowledgeClassification.INTERNAL]).toBeLessThan(
      KNOWLEDGE_CLASSIFICATION_RANK[KnowledgeClassification.RESTRICTED],
    );
  });

  it("declares exactly 6 classification levels", () => {
    expect(Object.values(KnowledgeClassification)).toHaveLength(6);
  });
});
