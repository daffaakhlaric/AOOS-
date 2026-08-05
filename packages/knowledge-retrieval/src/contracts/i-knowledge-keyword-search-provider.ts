import type { IKnowledgeSearchProvider } from "./i-knowledge-search-provider.js";

/** Interface only — no implementation in this package. A future full-text engine adapter implements this to serve `KnowledgeSearchMode.KEYWORD`/`EXACT_MATCH`/`PREFIX`/`WILDCARD`/`FUZZY` queries. */
export type IKnowledgeKeywordSearchProvider = IKnowledgeSearchProvider;
