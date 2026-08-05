import { z } from "zod";

import { knowledgeFilterSetSchema } from "./knowledge-filter-set.js";
import { KnowledgeQueryType } from "./knowledge-query-type.js";
import { KnowledgeSearchMode } from "./knowledge-search-mode.js";

/**
 * "QUERY OBJECT" (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — the request every
 * `KnowledgeRetriever` call carries through the Pipeline. `searchModes` drives which
 * `IKnowledgeSearchStrategy` provider(s) `KnowledgeSearchPipeline` dispatches to.
 */
export const knowledgeQuerySchema = z.object({
  id: z.string().min(1),
  type: z.nativeEnum(KnowledgeQueryType),
  text: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  searchModes: z.array(z.nativeEnum(KnowledgeSearchMode)).min(1),
  filters: knowledgeFilterSetSchema,
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
});

export type KnowledgeQuery = z.infer<typeof knowledgeQuerySchema>;
