import type { KnowledgeSourceExecution } from "../domain/knowledge-source-execution.js";
import type { KnowledgeSourceState } from "../domain/knowledge-source-state.js";

/** Interface only — no implementation in this package. A caller-supplied observer notified after every legal `KnowledgeSourceStateMachine` transition. */
export interface IKnowledgeSourceObserver {
  onStateChanged(
    execution: KnowledgeSourceExecution,
    from: KnowledgeSourceState,
    to: KnowledgeSourceState,
  ): void | Promise<void>;
}
