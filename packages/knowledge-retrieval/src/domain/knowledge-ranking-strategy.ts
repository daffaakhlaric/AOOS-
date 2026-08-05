/** "RANKING ENGINE: Support interfaces BM25, Hybrid, Semantic, Cross Encoder, Vector Ranking, Rule Based, LLM Ranking. No algorithms. Only contracts." (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — the 7 ranking approaches `KnowledgeRankingEngine` can dispatch to. */
export enum KnowledgeRankingStrategy {
  BM25 = "bm25",
  HYBRID = "hybrid",
  SEMANTIC = "semantic",
  CROSS_ENCODER = "cross_encoder",
  VECTOR_RANKING = "vector_ranking",
  RULE_BASED = "rule_based",
  LLM_RANKING = "llm_ranking",
}
