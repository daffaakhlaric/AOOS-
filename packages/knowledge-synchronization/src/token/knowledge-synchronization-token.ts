const KNOWLEDGE_SYNCHRONIZATION_TOKEN_PREFIX = "stok_";
const KNOWLEDGE_SYNCHRONIZATION_TOKEN_PATTERN =
  /^stok_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * "ExecutionToken" (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md — "SYNCHRONIZATION
 * CONTEXT") — "Every synchronization must have SynchronizationToken. Never scan
 * synchronization collections. Lookup by token." — the externally addressable handle
 * every imperative operation on a `KnowledgeSynchronizationInstance` uses, mirroring
 * `@aos/knowledge-retrieval`'s `KnowledgeRetrievalToken`.
 */
export type KnowledgeSynchronizationToken = string;

/** Generates a fresh, prefixed `KnowledgeSynchronizationToken`. */
export function generateKnowledgeSynchronizationToken(): KnowledgeSynchronizationToken {
  return `${KNOWLEDGE_SYNCHRONIZATION_TOKEN_PREFIX}${crypto.randomUUID()}`;
}

/** Structural validity check — does not confirm the token resolves to a live Instance. */
export function isKnowledgeSynchronizationToken(
  value: unknown,
): value is KnowledgeSynchronizationToken {
  return typeof value === "string" && KNOWLEDGE_SYNCHRONIZATION_TOKEN_PATTERN.test(value);
}
