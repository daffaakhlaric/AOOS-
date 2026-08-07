const KNOWLEDGE_GENERATOR_TOKEN_PREFIX = "kgen_";
const KNOWLEDGE_GENERATOR_TOKEN_PATTERN =
  /^kgen_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * "Registry ... Never scan collections." (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md) —
 * the externally addressable handle every imperative Generation Operation uses. Prefix
 * `kgen_` (Knowledge GENerator) — collision-free with existing prefixes (`ptok_`,
 * `stok_`, `ksrc_`, `kver_`, `kpol_`, `kmkt_`).
 */
export type KnowledgeGeneratorToken = string;

/** Generates a fresh, prefixed `KnowledgeGeneratorToken`. */
export function generateKnowledgeGeneratorToken(): KnowledgeGeneratorToken {
  return `${KNOWLEDGE_GENERATOR_TOKEN_PREFIX}${crypto.randomUUID()}`;
}

/** Structural validity check — does not confirm the token resolves to a live Generation. */
export function isKnowledgeGeneratorToken(value: unknown): value is KnowledgeGeneratorToken {
  return typeof value === "string" && KNOWLEDGE_GENERATOR_TOKEN_PATTERN.test(value);
}
