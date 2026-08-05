import type { IKnowledgeSearchProvider } from "./i-knowledge-search-provider.js";

/** Interface only — no implementation in this package. A future graph database adapter implements this to serve `KnowledgeSearchMode.RELATIONSHIP` queries. */
export type IKnowledgeRelationshipSearchProvider = IKnowledgeSearchProvider;
