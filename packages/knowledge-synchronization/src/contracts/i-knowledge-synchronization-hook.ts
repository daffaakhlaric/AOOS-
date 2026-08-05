import type { KnowledgeSynchronizationExecution } from "../domain/knowledge-synchronization-execution.js";

/** Interface only — no implementation in this package. A caller-supplied hook run by the Middleware Pipeline's "Custom Middleware" step — see `middleware/`. */
export interface IKnowledgeSynchronizationHook {
  readonly id: string;
  run(execution: KnowledgeSynchronizationExecution): void | Promise<void>;
}
