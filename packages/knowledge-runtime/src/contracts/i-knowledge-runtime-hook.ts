import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";

/** Interface only — no implementation in this package. A future consumer plugs custom pre/post-operation logic in without this package changing (a lighter-weight alternative to writing a full `IKnowledgeRuntimeMiddleware`). */
export interface IKnowledgeRuntimeHook {
  readonly name: string;
  before?(execution: KnowledgeRuntimeExecution, operation: string): Promise<void>;
  after?(execution: KnowledgeRuntimeExecution, operation: string): Promise<void>;
}
