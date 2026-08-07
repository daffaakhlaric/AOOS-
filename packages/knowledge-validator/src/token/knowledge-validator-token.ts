const KNOWLEDGE_VALIDATOR_TOKEN_PREFIX = "kval_";
const KNOWLEDGE_VALIDATOR_TOKEN_PATTERN =
  /^kval_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * "Registry ... Never scan collections." (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md) —
 * the externally addressable handle every imperative Validation Operation uses. Prefix
 * `kval_` (Knowledge VALidator) — collision-free with existing prefixes (`ptok_`,
 * `stok_`, `ksrc_`, `kver_`, `kpol_`, `kmkt_`, `kgen_`, `kqua_`).
 */
export type KnowledgeValidatorToken = string;

/** Generates a fresh, prefixed `KnowledgeValidatorToken`. */
export function generateKnowledgeValidatorToken(): KnowledgeValidatorToken {
  return `${KNOWLEDGE_VALIDATOR_TOKEN_PREFIX}${crypto.randomUUID()}`;
}

/** Structural validity check — does not confirm the token resolves to a live Validation. */
export function isKnowledgeValidatorToken(value: unknown): value is KnowledgeValidatorToken {
  return typeof value === "string" && KNOWLEDGE_VALIDATOR_TOKEN_PATTERN.test(value);
}
