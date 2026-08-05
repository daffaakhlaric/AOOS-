const KNOWLEDGE_SOURCE_TOKEN_PREFIX = "ksrc_";
const KNOWLEDGE_SOURCE_TOKEN_PATTERN =
  /^ksrc_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * "Every Source must have SourceToken. Never scan collections. Lookup by token."
 * (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md) — the externally addressable handle
 * every imperative operation on a `KnowledgeSourceInstance` uses. Judgment call: prefix
 * is `ksrc_`, not `stok_` — `@aos/knowledge-synchronization`'s `KnowledgeSynchronizationToken`
 * already owns `stok_`, and `@aos/knowledge-provider`'s `KnowledgeProviderToken` owns
 * `ptok_`, so `ksrc_` ("Knowledge SouRCe") keeps every Knowledge-platform token prefix
 * collision-free.
 */
export type KnowledgeSourceToken = string;

/** Generates a fresh, prefixed `KnowledgeSourceToken`. */
export function generateKnowledgeSourceToken(): KnowledgeSourceToken {
  return `${KNOWLEDGE_SOURCE_TOKEN_PREFIX}${crypto.randomUUID()}`;
}

/** Structural validity check — does not confirm the token resolves to a live Instance. */
export function isKnowledgeSourceToken(value: unknown): value is KnowledgeSourceToken {
  return typeof value === "string" && KNOWLEDGE_SOURCE_TOKEN_PATTERN.test(value);
}
