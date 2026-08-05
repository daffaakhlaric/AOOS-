const KNOWLEDGE_RETRIEVAL_TOKEN_PREFIX = "rtok_";
const KNOWLEDGE_RETRIEVAL_TOKEN_PATTERN =
  /^rtok_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * "ExecutionToken" (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md — "QUERY CONTEXT") — the
 * externally addressable handle every imperative operation on a
 * `KnowledgeRetrievalInstance` uses to look it up in `KnowledgeRetrievalRegistry`,
 * mirroring `@aos/knowledge-runtime`'s `KnowledgeRuntimeToken`.
 */
export type KnowledgeRetrievalToken = string;

/** Generates a fresh, prefixed `KnowledgeRetrievalToken`. */
export function generateKnowledgeRetrievalToken(): KnowledgeRetrievalToken {
  return `${KNOWLEDGE_RETRIEVAL_TOKEN_PREFIX}${crypto.randomUUID()}`;
}

/** Structural validity check — does not confirm the token resolves to a live Instance. */
export function isKnowledgeRetrievalToken(value: unknown): value is KnowledgeRetrievalToken {
  return typeof value === "string" && KNOWLEDGE_RETRIEVAL_TOKEN_PATTERN.test(value);
}
