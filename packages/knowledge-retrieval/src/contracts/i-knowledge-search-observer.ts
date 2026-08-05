import type { KnowledgeRetrievalExecution } from "../domain/knowledge-retrieval-execution.js";
import type { KnowledgeRetrievalState } from "../domain/knowledge-retrieval-state.js";

/** Interface only — no implementation in this package. A future consumer observes every Retrieval state transition without altering the Pipeline (unlike `IKnowledgeSearchHook`, which can). */
export interface IKnowledgeSearchObserver {
  onTransition(
    execution: KnowledgeRetrievalExecution,
    from: KnowledgeRetrievalState,
    to: KnowledgeRetrievalState,
  ): void;
}
