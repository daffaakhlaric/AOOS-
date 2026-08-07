const KNOWLEDGE_VERSION_TOKEN_PREFIX = "kver_";
const KNOWLEDGE_VERSION_TOKEN_PATTERN =
  /^kver_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * "Implement token-based registries. Never scan collections."
 * (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md) — the externally addressable handle every
 * imperative operation on a `KnowledgeVersionInstance` uses. Judgment call: prefix is
 * `kver_` — `ptok_` (knowledge-provider), `rtok_` (knowledge-retrieval), `ktok_`
 * (knowledge-runtime), `stok_` (knowledge-synchronization), and `ksrc_`
 * (knowledge-source-manager) are already taken, so `kver_` ("Knowledge VERsion") keeps
 * every Knowledge-platform token prefix collision-free.
 */
export type KnowledgeVersionToken = string;

/** Generates a fresh, prefixed `KnowledgeVersionToken`. */
export function generateKnowledgeVersionToken(): KnowledgeVersionToken {
  return `${KNOWLEDGE_VERSION_TOKEN_PREFIX}${crypto.randomUUID()}`;
}

/** Structural validity check — does not confirm the token resolves to a live Instance. */
export function isKnowledgeVersionToken(value: unknown): value is KnowledgeVersionToken {
  return typeof value === "string" && KNOWLEDGE_VERSION_TOKEN_PATTERN.test(value);
}
