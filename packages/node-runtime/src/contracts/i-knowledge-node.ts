/**
 * "KNOWLEDGE NODE: No RAG. No Vector DB. Only interface." (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md).
 * No class in this package implements these.
 */
export interface KnowledgeSearchQuery {
  readonly query: string;
  readonly knowledgeBaseId?: string;
  readonly topK?: number;
}

export interface KnowledgeSearchResultItem {
  readonly id: string;
  readonly content: string;
  readonly score: number;
}

export interface IKnowledgeRetriever {
  retrieve(query: KnowledgeSearchQuery): Promise<readonly KnowledgeSearchResultItem[]>;
}

export interface IKnowledgeProvider {
  readonly retriever: IKnowledgeRetriever;
}
