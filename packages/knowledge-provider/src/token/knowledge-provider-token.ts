const KNOWLEDGE_PROVIDER_TOKEN_PREFIX = "ptok_";
const KNOWLEDGE_PROVIDER_TOKEN_PATTERN =
  /^ptok_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * "Every provider must have ProviderToken. Never scan provider collections. Lookup by
 * token." (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md) — the externally addressable handle
 * every imperative operation on a `KnowledgeProviderInstance` uses, mirroring
 * `@aos/knowledge-synchronization`'s `KnowledgeSynchronizationToken`.
 */
export type KnowledgeProviderToken = string;

/** Generates a fresh, prefixed `KnowledgeProviderToken`. */
export function generateKnowledgeProviderToken(): KnowledgeProviderToken {
  return `${KNOWLEDGE_PROVIDER_TOKEN_PREFIX}${crypto.randomUUID()}`;
}

/** Structural validity check — does not confirm the token resolves to a live Instance. */
export function isKnowledgeProviderToken(value: unknown): value is KnowledgeProviderToken {
  return typeof value === "string" && KNOWLEDGE_PROVIDER_TOKEN_PATTERN.test(value);
}
