/** "KNOWLEDGE RELATIONSHIPS" (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — the 15 relationship kinds `KnowledgeRelationshipEngine` understands. */
export enum KnowledgeRelationshipType {
  PARENT = "parent",
  CHILD = "child",
  REFERENCE = "reference",
  DUPLICATE = "duplicate",
  RELATED = "related",
  DEPENDS_ON = "depends_on",
  USES = "uses",
  IMPLEMENTS = "implements",
  GENERATED_FROM = "generated_from",
  VERSION_OF = "version_of",
  DERIVED_FROM = "derived_from",
  REQUIRED_BY = "required_by",
  CONSUMED_BY = "consumed_by",
  BELONGS_TO = "belongs_to",
  LINKED_TO = "linked_to",
}

/**
 * Every relationship kind has a structural inverse — e.g. registering `PARENT`
 * `(a -> b)` implies `CHILD` `(b -> a)`. `RelationshipEngine#add()` uses this to keep
 * the adjacency graph consistent in both directions without the caller registering both
 * sides explicitly.
 */
export const KNOWLEDGE_RELATIONSHIP_INVERSE: Readonly<
  Record<KnowledgeRelationshipType, KnowledgeRelationshipType>
> = {
  [KnowledgeRelationshipType.PARENT]: KnowledgeRelationshipType.CHILD,
  [KnowledgeRelationshipType.CHILD]: KnowledgeRelationshipType.PARENT,
  [KnowledgeRelationshipType.REFERENCE]: KnowledgeRelationshipType.REFERENCE,
  [KnowledgeRelationshipType.DUPLICATE]: KnowledgeRelationshipType.DUPLICATE,
  [KnowledgeRelationshipType.RELATED]: KnowledgeRelationshipType.RELATED,
  [KnowledgeRelationshipType.DEPENDS_ON]: KnowledgeRelationshipType.REQUIRED_BY,
  [KnowledgeRelationshipType.REQUIRED_BY]: KnowledgeRelationshipType.DEPENDS_ON,
  [KnowledgeRelationshipType.USES]: KnowledgeRelationshipType.CONSUMED_BY,
  [KnowledgeRelationshipType.CONSUMED_BY]: KnowledgeRelationshipType.USES,
  [KnowledgeRelationshipType.IMPLEMENTS]: KnowledgeRelationshipType.RELATED,
  [KnowledgeRelationshipType.GENERATED_FROM]: KnowledgeRelationshipType.RELATED,
  [KnowledgeRelationshipType.VERSION_OF]: KnowledgeRelationshipType.VERSION_OF,
  [KnowledgeRelationshipType.DERIVED_FROM]: KnowledgeRelationshipType.RELATED,
  [KnowledgeRelationshipType.BELONGS_TO]: KnowledgeRelationshipType.PARENT,
  [KnowledgeRelationshipType.LINKED_TO]: KnowledgeRelationshipType.LINKED_TO,
};
