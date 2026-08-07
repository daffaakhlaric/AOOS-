/**
 * "DEPENDENCY METADATA: Support: Required Dependencies, Optional Dependencies,
 * Recommended Dependencies, Conflicting Packages. Metadata only."
 * (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md) — the exact 4 dependency kinds.
 */
export enum MarketplaceDependencyKind {
  REQUIRED = "required",
  OPTIONAL = "optional",
  RECOMMENDED = "recommended",
  CONFLICTING = "conflicting",
}
