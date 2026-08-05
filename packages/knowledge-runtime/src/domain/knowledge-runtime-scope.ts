import type { KnowledgeScope } from "@aos/knowledge-engine";

/**
 * "KnowledgeRuntimeScope" (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) — the same
 * Organization → Tenant → Workspace → Department → Team → Solution Pack → Project →
 * Library isolation boundary `@aos/knowledge-engine`'s `KnowledgeScope` already defines.
 * Reused directly rather than re-declared, so a Runtime Scope and the Knowledge Asset
 * Scope it governs can never structurally drift apart.
 */
export type KnowledgeRuntimeScope = KnowledgeScope;
