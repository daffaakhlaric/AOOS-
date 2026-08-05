import type { IKnowledgeSearchProvider } from "./i-knowledge-search-provider.js";

/** Interface only — no implementation in this package. A future adapter combining multiple search techniques implements this to serve `KnowledgeSearchMode.HYBRID` queries. */
export type IKnowledgeHybridSearchProvider = IKnowledgeSearchProvider;
