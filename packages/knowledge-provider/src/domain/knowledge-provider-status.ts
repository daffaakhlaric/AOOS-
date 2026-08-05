/** "PROVIDER METADATA: ... ProviderStatus ..." (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md) — the catalog-level status of a registered Provider definition, independent of its live `KnowledgeProviderState`. */
export enum KnowledgeProviderStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  DEPRECATED = "deprecated",
}
