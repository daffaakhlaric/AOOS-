/**
 * "REGISTRY: Token-based only. Buckets: Package Registry, Listing Registry, Publisher
 * Registry, Category Registry, Certification Registry, Compatibility Registry,
 * Dependency Registry, Statistics Registry. Never scan collections."
 * (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md) — the exact 8 buckets from the prompt.
 */
export enum KnowledgeMarketplaceRegistryBucket {
  PACKAGE = "package",
  LISTING = "listing",
  PUBLISHER = "publisher",
  CATEGORY = "category",
  CERTIFICATION = "certification",
  COMPATIBILITY = "compatibility",
  DEPENDENCY = "dependency",
  STATISTICS = "statistics",
}
