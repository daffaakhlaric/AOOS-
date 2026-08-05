import type { KnowledgeQueryContext } from "../context/knowledge-query-context.js";
import type { KnowledgeResult } from "../domain/knowledge-result.js";

/** Interface only — no implementation in this package. A future post-processor transforms the final Result list (e.g. deduplication, snippet extraction) after Filtering, before Metrics. */
export interface IKnowledgeResultPostProcessor {
  process(
    results: readonly KnowledgeResult[],
    context: KnowledgeQueryContext,
  ): Promise<readonly KnowledgeResult[]>;
}
