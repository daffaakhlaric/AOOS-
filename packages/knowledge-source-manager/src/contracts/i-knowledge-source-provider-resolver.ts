/**
 * Interface only — not one of the prompt's 13 named Extension Points, but required by
 * key adaptation #4: the Source Pipeline's "Provider Resolution" stage (stage 5) must
 * resolve a Source's `providerId` against `@aos/knowledge-provider` by *interface
 * reference only* — "Only interface references." (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md
 * — "DEPENDENCY RULES"). This package declares no concrete import from
 * `@aos/knowledge-provider` anywhere; a caller wires an adapter implementing this
 * minimal shape (e.g. wrapping a real `KnowledgeProviderResolver`) into
 * `KnowledgeSourcePipeline`/`KnowledgeSourceManager` if/when Provider Resolution should
 * be enforced. When no resolver is supplied, the stage is a no-op pass-through —
 * mirroring `@aos/knowledge-provider`'s own optional `permissionChecker` pattern.
 */
export interface IKnowledgeSourceProviderResolver {
  resolveProvider(providerId: string): unknown | Promise<unknown>;
}
