import { EMPTY_KNOWLEDGE_FILTER_SET } from "../../src/domain/knowledge-filter-set.js";
import { KnowledgeQueryType } from "../../src/domain/knowledge-query-type.js";
import type { KnowledgeRetrievalExecution } from "../../src/domain/knowledge-retrieval-execution.js";
import { KnowledgeRetrievalState } from "../../src/domain/knowledge-retrieval-state.js";
import { KnowledgeSearchMode } from "../../src/domain/knowledge-search-mode.js";

import { contextFixture } from "./context-fixture.js";

export function executionFixture(
  overrides: Partial<KnowledgeRetrievalExecution> = {},
): KnowledgeRetrievalExecution {
  const now = new Date().toISOString();
  return {
    instance: {
      id: "instance-1",
      token: "rtok_fixed",
      queryId: "q-1",
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      state: KnowledgeRetrievalState.CREATED,
      resultCount: 0,
      createdAt: now,
      updatedAt: now,
    },
    context: contextFixture(),
    query: {
      id: "q-1",
      type: KnowledgeQueryType.KEYWORD,
      keywords: ["hello"],
      searchModes: [KnowledgeSearchMode.KEYWORD],
      filters: EMPTY_KNOWLEDGE_FILTER_SET,
      limit: 20,
      offset: 0,
      createdAt: now,
    },
    results: [],
    history: [],
    ...overrides,
  };
}
