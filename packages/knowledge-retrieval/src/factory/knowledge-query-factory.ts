import {
  EMPTY_KNOWLEDGE_FILTER_SET,
  type KnowledgeFilterSet,
} from "../domain/knowledge-filter-set.js";
import type { KnowledgeQueryType } from "../domain/knowledge-query-type.js";
import type { KnowledgeQuery } from "../domain/knowledge-query.js";
import type { KnowledgeSearchMode } from "../domain/knowledge-search-mode.js";
import { generateId } from "../utils/id.js";

export interface CreateQueryInput {
  readonly type: KnowledgeQueryType;
  readonly searchModes: readonly KnowledgeSearchMode[];
  readonly text?: string;
  readonly keywords?: readonly string[];
  readonly filters?: KnowledgeFilterSet;
  readonly limit?: number;
  readonly offset?: number;
}

/** Builds a fresh `KnowledgeQuery`. */
export class KnowledgeQueryFactory {
  create(input: CreateQueryInput): KnowledgeQuery {
    return {
      id: generateId(),
      type: input.type,
      text: input.text,
      keywords: [...(input.keywords ?? [])],
      searchModes: [...input.searchModes],
      filters: input.filters ?? EMPTY_KNOWLEDGE_FILTER_SET,
      limit: input.limit ?? 20,
      offset: input.offset ?? 0,
      createdAt: new Date().toISOString(),
    };
  }
}
