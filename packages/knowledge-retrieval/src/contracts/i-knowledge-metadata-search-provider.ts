import type { IKnowledgeSearchProvider } from "./i-knowledge-search-provider.js";

/** Interface only — no implementation in this package. A future faceted-search backend adapter implements this to serve `KnowledgeSearchMode.METADATA` queries. */
export type IKnowledgeMetadataSearchProvider = IKnowledgeSearchProvider;
