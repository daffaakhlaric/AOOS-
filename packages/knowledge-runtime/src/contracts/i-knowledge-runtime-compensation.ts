import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";

/** Interface only — no implementation in this package. A future consumer runs compensating logic when a Runtime Instance transitions to `FAILED`. */
export interface IKnowledgeRuntimeCompensation {
  compensate(execution: KnowledgeRuntimeExecution, reason: string): Promise<void>;
}
