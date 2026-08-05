import { describe, expect, it } from "vitest";

import { EMPTY_KNOWLEDGE_FILTER_SET } from "../../src/domain/knowledge-filter-set.js";
import { KnowledgeQueryType } from "../../src/domain/knowledge-query-type.js";
import { knowledgeQuerySchema } from "../../src/domain/knowledge-query.js";
import { KnowledgeSearchMode } from "../../src/domain/knowledge-search-mode.js";

describe("knowledgeQuerySchema", () => {
  it("defaults keywords to [], limit to 20, offset to 0", () => {
    const query = knowledgeQuerySchema.parse({
      id: "q-1",
      type: KnowledgeQueryType.KEYWORD,
      searchModes: [KnowledgeSearchMode.KEYWORD],
      filters: EMPTY_KNOWLEDGE_FILTER_SET,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(query.keywords).toEqual([]);
    expect(query.limit).toBe(20);
    expect(query.offset).toBe(0);
  });

  it("rejects an empty searchModes array", () => {
    expect(() =>
      knowledgeQuerySchema.parse({
        id: "q-1",
        type: KnowledgeQueryType.KEYWORD,
        searchModes: [],
        filters: EMPTY_KNOWLEDGE_FILTER_SET,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("rejects a blank id", () => {
    expect(() =>
      knowledgeQuerySchema.parse({
        id: "",
        type: KnowledgeQueryType.KEYWORD,
        searchModes: [KnowledgeSearchMode.KEYWORD],
        filters: EMPTY_KNOWLEDGE_FILTER_SET,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("rejects a non-positive limit", () => {
    expect(() =>
      knowledgeQuerySchema.parse({
        id: "q-1",
        type: KnowledgeQueryType.KEYWORD,
        searchModes: [KnowledgeSearchMode.KEYWORD],
        filters: EMPTY_KNOWLEDGE_FILTER_SET,
        limit: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });
});
