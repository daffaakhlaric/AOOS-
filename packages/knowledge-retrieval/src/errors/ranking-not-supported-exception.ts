import {
  KnowledgeRetrievalException,
  type KnowledgeRetrievalExceptionOptions,
} from "./knowledge-retrieval-exception.js";

/** Thrown by `KnowledgeRankingEngine` when a caller explicitly requires a `KnowledgeRankingStrategy` and no matching `IKnowledgeRankingProvider` is registered — "No algorithms. Only contracts." */
export class RankingNotSupportedException extends KnowledgeRetrievalException {
  constructor(message: string, options: KnowledgeRetrievalExceptionOptions = {}) {
    super(message, options);
  }
}
