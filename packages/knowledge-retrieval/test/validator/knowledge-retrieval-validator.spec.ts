import { describe, expect, it } from "vitest";

import { EMPTY_KNOWLEDGE_FILTER_SET } from "../../src/domain/knowledge-filter-set.js";
import { KnowledgeQueryType } from "../../src/domain/knowledge-query-type.js";
import { KnowledgeSearchMode } from "../../src/domain/knowledge-search-mode.js";
import { ContextValidator } from "../../src/validator/context-validator.js";
import { FilterValidator } from "../../src/validator/filter-validator.js";
import { KnowledgeRetrievalValidator } from "../../src/validator/knowledge-retrieval-validator.js";
import { LimitValidator } from "../../src/validator/limit-validator.js";
import { QueryValidator } from "../../src/validator/query-validator.js";
import { SearchModeValidator } from "../../src/validator/search-mode-validator.js";
import { contextFixture } from "../helpers/context-fixture.js";

function queryFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "q-1",
    type: KnowledgeQueryType.KEYWORD,
    keywords: ["hello"],
    searchModes: [KnowledgeSearchMode.KEYWORD],
    filters: EMPTY_KNOWLEDGE_FILTER_SET,
    limit: 20,
    offset: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  } as never;
}

describe("QueryValidator", () => {
  it("passes a query with keywords and search modes", () => {
    const result = new QueryValidator().validate({
      query: queryFixture(),
      context: contextFixture(),
    });
    expect(result.valid).toBe(true);
  });

  it("flags an empty searchModes array", () => {
    const result = new QueryValidator().validate({
      query: queryFixture({ searchModes: [] }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(false);
  });

  it("flags a blank text with no keywords", () => {
    const result = new QueryValidator().validate({
      query: queryFixture({ keywords: [], text: "" }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(false);
  });

  it("passes when text is supplied without keywords", () => {
    const result = new QueryValidator().validate({
      query: queryFixture({ keywords: [], text: "hello" }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(true);
  });
});

describe("ContextValidator", () => {
  it("passes a well-formed context", () => {
    const result = new ContextValidator().validate({
      query: queryFixture(),
      context: contextFixture(),
    });
    expect(result.valid).toBe(true);
  });

  it("flags a blank tenantId", () => {
    const result = new ContextValidator().validate({
      query: queryFixture(),
      context: contextFixture({ tenantId: "  " }),
    });
    expect(result.valid).toBe(false);
  });

  it("flags a blank correlationId", () => {
    const result = new ContextValidator().validate({
      query: queryFixture(),
      context: contextFixture({ correlationId: " " }),
    });
    expect(result.valid).toBe(false);
  });
});

describe("SearchModeValidator", () => {
  it("passes valid, non-duplicate search modes", () => {
    const result = new SearchModeValidator().validate({
      query: queryFixture(),
      context: contextFixture(),
    });
    expect(result.valid).toBe(true);
  });

  it("flags an unknown search mode", () => {
    const result = new SearchModeValidator().validate({
      query: queryFixture({ searchModes: ["bogus"] }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(false);
  });

  it("flags duplicate search modes", () => {
    const result = new SearchModeValidator().validate({
      query: queryFixture({
        searchModes: [KnowledgeSearchMode.KEYWORD, KnowledgeSearchMode.KEYWORD],
      }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(false);
  });
});

describe("FilterValidator", () => {
  it("passes when filters.tags has no duplicates", () => {
    const result = new FilterValidator().validate({
      query: queryFixture({ filters: { tags: ["a", "b"] } }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(true);
  });

  it("flags duplicate tags", () => {
    const result = new FilterValidator().validate({
      query: queryFixture({ filters: { tags: ["a", "a"] } }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(false);
  });

  it("passes when tags is undefined", () => {
    const result = new FilterValidator().validate({
      query: queryFixture(),
      context: contextFixture(),
    });
    expect(result.valid).toBe(true);
  });
});

describe("LimitValidator", () => {
  it("passes a limit within the maximum", () => {
    const result = new LimitValidator().validate({
      query: queryFixture({ limit: 50 }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(true);
  });

  it("flags a limit above the maximum", () => {
    const result = new LimitValidator().validate({
      query: queryFixture({ limit: 500 }),
      context: contextFixture(),
    });
    expect(result.valid).toBe(false);
  });
});

describe("KnowledgeRetrievalValidator", () => {
  it("passes a fully valid query/context pair", () => {
    const validator = new KnowledgeRetrievalValidator();
    const result = validator.validate({ query: queryFixture(), context: contextFixture() });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("aggregates issues from multiple stages without short-circuiting", () => {
    const validator = new KnowledgeRetrievalValidator();
    const result = validator.validate({
      query: queryFixture({ searchModes: [], limit: 500 }),
      context: contextFixture({ tenantId: "" }),
    });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });

  it("runs caller-supplied extra stages", () => {
    const extraStage = {
      name: "extra",
      validate: () => ({ valid: false, issues: [{ path: "extra", message: "always fails" }] }),
    };
    const validator = new KnowledgeRetrievalValidator([extraStage]);
    const result = validator.validate({ query: queryFixture(), context: contextFixture() });
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([{ path: "extra", message: "always fails" }]);
  });
});
