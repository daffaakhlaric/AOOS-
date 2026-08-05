import {
  KnowledgeRetrievalException,
  type KnowledgeRetrievalExceptionOptions,
} from "./knowledge-retrieval-exception.js";

/** Thrown by `KnowledgePolicyResolver` when a Query as a whole is denied by policy (individual result violations are filtered instead of thrown — see `KnowledgePolicyResolver`). */
export class RetrievalPolicyViolationException extends KnowledgeRetrievalException {
  constructor(message: string, options: KnowledgeRetrievalExceptionOptions = {}) {
    super(message, options);
  }
}
