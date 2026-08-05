import type { KnowledgeProviderExecution } from "../domain/knowledge-provider-execution.js";

/** Interface only — no implementation in this package. Observes every Provider state transition, independent of the Event Bus. */
export interface IKnowledgeProviderObserver {
  readonly id: string;
  onTransition(execution: KnowledgeProviderExecution): void | Promise<void>;
}
