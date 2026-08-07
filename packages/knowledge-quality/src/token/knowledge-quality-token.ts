const KNOWLEDGE_QUALITY_TOKEN_PREFIX = "kqua_";
const KNOWLEDGE_QUALITY_TOKEN_PATTERN =
  /^kqua_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * "Registry ... Never scan collections." (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md) —
 * the externally addressable handle every imperative Assessment Operation uses. Prefix
 * `kqua_` (Knowledge QUAlity) — collision-free with existing prefixes (`ptok_`,
 * `stok_`, `ksrc_`, `kver_`, `kpol_`, `kmkt_`, `kgen_`).
 */
export type KnowledgeQualityToken = string;

/** Generates a fresh, prefixed `KnowledgeQualityToken`. */
export function generateKnowledgeQualityToken(): KnowledgeQualityToken {
  return `${KNOWLEDGE_QUALITY_TOKEN_PREFIX}${crypto.randomUUID()}`;
}

/** Structural validity check — does not confirm the token resolves to a live Assessment. */
export function isKnowledgeQualityToken(value: unknown): value is KnowledgeQualityToken {
  return typeof value === "string" && KNOWLEDGE_QUALITY_TOKEN_PATTERN.test(value);
}
