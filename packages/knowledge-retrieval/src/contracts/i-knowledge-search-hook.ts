import type { KnowledgeRetrievalExecution } from "../domain/knowledge-retrieval-execution.js";

/** Interface only — no implementation in this package. A future consumer plugs custom pre/post-stage logic into `KnowledgeSearchPipeline` without this package changing. */
export interface IKnowledgeSearchHook {
  readonly name: string;
  before?(execution: KnowledgeRetrievalExecution, stage: string): Promise<void>;
  after?(execution: KnowledgeRetrievalExecution, stage: string): Promise<void>;
}
