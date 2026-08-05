import type { IKnowledgeSearchProvider } from "./i-knowledge-search-provider.js";

/** Interface only — no implementation in this package. A future indexing-backed adapter implements this to serve `KnowledgeSearchMode.NAMESPACE`/`COLLECTION`/`WORKSPACE`/`TENANT` queries. */
export type IKnowledgeNamespaceSearchProvider = IKnowledgeSearchProvider;
