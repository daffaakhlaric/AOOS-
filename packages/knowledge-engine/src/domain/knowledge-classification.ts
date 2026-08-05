/** "CLASSIFICATION" (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — ordered least to most sensitive. */
export enum KnowledgeClassification {
  PUBLIC = "public",
  INTERNAL = "internal",
  RESTRICTED = "restricted",
  CONFIDENTIAL = "confidential",
  SECRET = "secret",
  HIGHLY_CONFIDENTIAL = "highly_confidential",
}

/** Sensitivity rank — higher is more sensitive. Used by `permission/`/`policy/` to compare Classification levels. */
export const KNOWLEDGE_CLASSIFICATION_RANK: Readonly<Record<KnowledgeClassification, number>> = {
  [KnowledgeClassification.PUBLIC]: 0,
  [KnowledgeClassification.INTERNAL]: 1,
  [KnowledgeClassification.RESTRICTED]: 2,
  [KnowledgeClassification.CONFIDENTIAL]: 3,
  [KnowledgeClassification.SECRET]: 4,
  [KnowledgeClassification.HIGHLY_CONFIDENTIAL]: 5,
};
