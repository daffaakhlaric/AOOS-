const KNOWLEDGE_MARKETPLACE_TOKEN_PREFIX = "kmkt_";
const KNOWLEDGE_MARKETPLACE_TOKEN_PATTERN =
  /^kmkt_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * "Registry: Token-based only. ... Never scan collections." (docs/PROMPT-005.7J-
 * KNOWLEDGE-MARKETPLACE.md) — the externally addressable handle every imperative
 * operation on a `MarketplaceListing` uses. Prefix `kmkt_` (Knowledge MarKeT) —
 * collision-free with existing prefixes (`ptok_`, `stok_`, `ksrc_`, `kver_`, `kpol_`).
 */
export type KnowledgeMarketplaceToken = string;

/** Generates a fresh, prefixed `KnowledgeMarketplaceToken`. */
export function generateKnowledgeMarketplaceToken(): KnowledgeMarketplaceToken {
  return `${KNOWLEDGE_MARKETPLACE_TOKEN_PREFIX}${crypto.randomUUID()}`;
}

/** Structural validity check — does not confirm the token resolves to a live Listing. */
export function isKnowledgeMarketplaceToken(value: unknown): value is KnowledgeMarketplaceToken {
  return typeof value === "string" && KNOWLEDGE_MARKETPLACE_TOKEN_PATTERN.test(value);
}
