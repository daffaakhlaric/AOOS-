import type { KnowledgeQueryContext } from "../context/knowledge-query-context.js";

import type { KnowledgeQuery } from "./knowledge-query.js";
import type { KnowledgeResult } from "./knowledge-result.js";
import type { KnowledgeRetrievalHistory } from "./knowledge-retrieval-history.js";
import type { KnowledgeRetrievalInstance } from "./knowledge-retrieval-instance.js";

/**
 * The unit every State Machine transition / Pipeline stage reads and returns —
 * `instance` + `context` + `query` + the accumulated `results` + the ordered `history`
 * of every transition so far. Mirrors `@aos/knowledge-runtime`'s
 * `KnowledgeRuntimeExecution` triple, extended with `query`/`results`.
 */
export interface KnowledgeRetrievalExecution {
  readonly instance: KnowledgeRetrievalInstance;
  readonly context: KnowledgeQueryContext;
  readonly query: KnowledgeQuery;
  readonly results: readonly KnowledgeResult[];
  readonly history: KnowledgeRetrievalHistory;
}
