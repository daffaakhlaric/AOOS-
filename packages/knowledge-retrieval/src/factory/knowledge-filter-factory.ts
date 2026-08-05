import {
  EMPTY_KNOWLEDGE_FILTER_SET,
  type KnowledgeFilterSet,
} from "../domain/knowledge-filter-set.js";

/** Builds a fresh `KnowledgeFilterSet`, merging caller-supplied overrides onto the empty default. */
export class KnowledgeFilterFactory {
  create(overrides: Partial<KnowledgeFilterSet> = {}): KnowledgeFilterSet {
    return { ...EMPTY_KNOWLEDGE_FILTER_SET, ...overrides };
  }
}
