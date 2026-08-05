/** "REGISTRY: Maintain Indexes, Versions, Namespaces, Templates, Policies, Relationships, Statistics, Health." (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md) — Health is derived (see `health/`), not a stored bucket. */
export enum KnowledgeIndexRegistryBucket {
  INDEX = "index",
  VERSION = "version",
  NAMESPACE = "namespace",
  TEMPLATE = "template",
  POLICY = "policy",
  RELATIONSHIP = "relationship",
  STATISTICS = "statistics",
}
