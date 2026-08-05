/** "QUERY OBJECT" (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — the 13 Query kinds `KnowledgeQuery.type` can carry. */
export enum KnowledgeQueryType {
  SUPPORT = "support",
  QUESTION = "question",
  KEYWORD = "keyword",
  METADATA = "metadata",
  RELATIONSHIP = "relationship",
  NAMESPACE = "namespace",
  CATEGORY = "category",
  TAG = "tag",
  HYBRID = "hybrid",
  TEMPLATE = "template",
  POLICY = "policy",
  VERSION = "version",
  COLLECTION = "collection",
}
