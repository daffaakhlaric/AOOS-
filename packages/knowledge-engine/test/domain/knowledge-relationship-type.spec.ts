import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_RELATIONSHIP_INVERSE,
  KnowledgeRelationshipType,
} from "../../src/domain/knowledge-relationship-type.js";

describe("Domain Test — KnowledgeRelationshipType inverse table", () => {
  it("declares exactly 15 relationship types", () => {
    expect(Object.values(KnowledgeRelationshipType)).toHaveLength(15);
  });

  it("every relationship type has a declared inverse", () => {
    for (const type of Object.values(KnowledgeRelationshipType)) {
      expect(KNOWLEDGE_RELATIONSHIP_INVERSE[type]).toBeDefined();
    }
  });

  it("PARENT's inverse is CHILD and vice versa", () => {
    expect(KNOWLEDGE_RELATIONSHIP_INVERSE[KnowledgeRelationshipType.PARENT]).toBe(
      KnowledgeRelationshipType.CHILD,
    );
    expect(KNOWLEDGE_RELATIONSHIP_INVERSE[KnowledgeRelationshipType.CHILD]).toBe(
      KnowledgeRelationshipType.PARENT,
    );
  });

  it("DEPENDS_ON's inverse is REQUIRED_BY and vice versa", () => {
    expect(KNOWLEDGE_RELATIONSHIP_INVERSE[KnowledgeRelationshipType.DEPENDS_ON]).toBe(
      KnowledgeRelationshipType.REQUIRED_BY,
    );
    expect(KNOWLEDGE_RELATIONSHIP_INVERSE[KnowledgeRelationshipType.REQUIRED_BY]).toBe(
      KnowledgeRelationshipType.DEPENDS_ON,
    );
  });

  it("symmetric types (REFERENCE/DUPLICATE/RELATED/LINKED_TO/VERSION_OF) are their own inverse", () => {
    expect(KNOWLEDGE_RELATIONSHIP_INVERSE[KnowledgeRelationshipType.REFERENCE]).toBe(
      KnowledgeRelationshipType.REFERENCE,
    );
    expect(KNOWLEDGE_RELATIONSHIP_INVERSE[KnowledgeRelationshipType.DUPLICATE]).toBe(
      KnowledgeRelationshipType.DUPLICATE,
    );
    expect(KNOWLEDGE_RELATIONSHIP_INVERSE[KnowledgeRelationshipType.RELATED]).toBe(
      KnowledgeRelationshipType.RELATED,
    );
    expect(KNOWLEDGE_RELATIONSHIP_INVERSE[KnowledgeRelationshipType.LINKED_TO]).toBe(
      KnowledgeRelationshipType.LINKED_TO,
    );
    expect(KNOWLEDGE_RELATIONSHIP_INVERSE[KnowledgeRelationshipType.VERSION_OF]).toBe(
      KnowledgeRelationshipType.VERSION_OF,
    );
  });
});
