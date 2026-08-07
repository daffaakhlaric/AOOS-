const KNOWLEDGE_POLICY_TOKEN_PREFIX = "kpol_";
const KNOWLEDGE_POLICY_TOKEN_PATTERN =
  /^kpol_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * "Implement token-based registries. Never scan collections."
 * (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md) — the externally addressable handle every
 * imperative operation on a `KnowledgePolicyInstance` uses. Prefix `kpol_` (Knowledge
 * POLicy) — collision-free with existing prefixes.
 */
export type KnowledgePolicyToken = string;

/** Generates a fresh, prefixed `KnowledgePolicyToken`. */
export function generateKnowledgePolicyToken(): KnowledgePolicyToken {
  return `${KNOWLEDGE_POLICY_TOKEN_PREFIX}${crypto.randomUUID()}`;
}

/** Structural validity check — does not confirm the token resolves to a live Instance. */
export function isKnowledgePolicyToken(value: unknown): value is KnowledgePolicyToken {
  return typeof value === "string" && KNOWLEDGE_POLICY_TOKEN_PATTERN.test(value);
}
