import type { IKnowledgeSearchProvider } from "./i-knowledge-search-provider.js";

/** Interface only — no implementation in this package. A future semantic/embedding-backed adapter implements this to serve `KnowledgeSearchMode.SEMANTIC_REFERENCE` queries — this package never generates the embedding itself. */
export type IKnowledgeSemanticSearchProvider = IKnowledgeSearchProvider;
