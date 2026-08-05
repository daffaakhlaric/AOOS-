import type { IKnowledgeSearchStrategy } from "./i-search-strategy.js";

/**
 * "Keyword Strategy, Metadata Strategy, Relationship Strategy, Namespace Strategy,
 * Policy Strategy, Permission Strategy, Hybrid Strategy, Semantic Strategy. No
 * implementations." (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — the 8 named Strategy
 * interfaces the source prompt requires, each sharing `IKnowledgeSearchStrategy`'s shape.
 */
export type IKeywordSearchStrategy = IKnowledgeSearchStrategy;
export type IMetadataSearchStrategy = IKnowledgeSearchStrategy;
export type IRelationshipSearchStrategy = IKnowledgeSearchStrategy;
export type INamespaceSearchStrategy = IKnowledgeSearchStrategy;
export type IPolicySearchStrategy = IKnowledgeSearchStrategy;
export type IPermissionSearchStrategy = IKnowledgeSearchStrategy;
export type IHybridSearchStrategy = IKnowledgeSearchStrategy;
export type ISemanticSearchStrategy = IKnowledgeSearchStrategy;
