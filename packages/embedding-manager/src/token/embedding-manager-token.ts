const EMBEDDING_MANAGER_TOKEN_PREFIX = "embt_";
const EMBEDDING_MANAGER_TOKEN_PATTERN =
  /^embt_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * "Registry ... Never scan collections." (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md) — the
 * externally addressable handle every imperative Embedding Operation uses. Prefix `embt_`
 * (EMBedding manager TOken) — collision-free with existing prefixes (`ptok_`, `stok_`,
 * `ksrc_`, `kver_`, `kpol_`, `kmkt_`, `kgen_`, `kqua_`, `kval_`).
 */
export type EmbeddingManagerToken = string;

/** Generates a fresh, prefixed `EmbeddingManagerToken`. */
export function generateEmbeddingManagerToken(): EmbeddingManagerToken {
  return `${EMBEDDING_MANAGER_TOKEN_PREFIX}${crypto.randomUUID()}`;
}

/** Structural validity check — does not confirm the token resolves to a live Embedding. */
export function isEmbeddingManagerToken(value: unknown): value is EmbeddingManagerToken {
  return typeof value === "string" && EMBEDDING_MANAGER_TOKEN_PATTERN.test(value);
}
