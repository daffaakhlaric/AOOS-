import type { KnowledgeProviderExecution } from "../domain/knowledge-provider-execution.js";

/** Interface only — no implementation in this package. A caller-supplied hook run by the Middleware Pipeline's "Custom Middleware" step — see `middleware/`. */
export interface IKnowledgeProviderHook {
  readonly id: string;
  run(execution: KnowledgeProviderExecution): void | Promise<void>;
}
