const KNOWLEDGE_RUNTIME_TOKEN_PREFIX = "ktok_";
const KNOWLEDGE_RUNTIME_TOKEN_PATTERN =
  /^ktok_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * "Every runtime instance must have KnowledgeRuntimeToken. Never search runtime instances
 * by scanning collections. Use token lookup." (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) —
 * the externally addressable handle every imperative operation on a
 * `KnowledgeRuntimeInstance` (start/suspend/resume/complete/fail/cancel/expire/destroy)
 * uses to look it up in `KnowledgeRuntimeRegistry`, mirroring `@aos/workflow-runtime`'s
 * `ExecutionToken`.
 */
export type KnowledgeRuntimeToken = string;

/** Generates a fresh, prefixed `KnowledgeRuntimeToken`. */
export function generateKnowledgeRuntimeToken(): KnowledgeRuntimeToken {
  return `${KNOWLEDGE_RUNTIME_TOKEN_PREFIX}${crypto.randomUUID()}`;
}

/** Structural validity check — does not confirm the token resolves to a live Instance. */
export function isKnowledgeRuntimeToken(value: unknown): value is KnowledgeRuntimeToken {
  return typeof value === "string" && KNOWLEDGE_RUNTIME_TOKEN_PATTERN.test(value);
}
