import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";
import type { KnowledgeRuntimeState } from "../domain/knowledge-runtime-state.js";

/** Interface only — no implementation in this package. A future consumer observes every state transition without altering the pipeline (unlike `IKnowledgeRuntimeHook`, which can). */
export interface IKnowledgeRuntimeObserver {
  onTransition(
    execution: KnowledgeRuntimeExecution,
    from: KnowledgeRuntimeState,
    to: KnowledgeRuntimeState,
  ): void;
}
