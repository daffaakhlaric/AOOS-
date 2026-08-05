import { describe, expect, it } from "vitest";

import { EMPTY_KNOWLEDGE_FILTER_SET } from "../../src/domain/knowledge-filter-set.js";
import { KnowledgeQueryType } from "../../src/domain/knowledge-query-type.js";
import { KnowledgeSearchMode } from "../../src/domain/knowledge-search-mode.js";
import { SearchStrategyNotFoundException } from "../../src/errors/search-strategy-not-found-exception.js";
import { KnowledgeRetrievalRegistry } from "../../src/registry/knowledge-retrieval-registry.js";
import { KnowledgeSearchStrategy } from "../../src/strategy/knowledge-search-strategy.js";
import { contextFixture } from "../helpers/context-fixture.js";

const query = {
  id: "q-1",
  type: KnowledgeQueryType.KEYWORD,
  keywords: ["hi"],
  searchModes: [KnowledgeSearchMode.KEYWORD],
  filters: EMPTY_KNOWLEDGE_FILTER_SET,
  limit: 20,
  offset: 0,
  createdAt: new Date().toISOString(),
} as never;

describe("KnowledgeSearchStrategy", () => {
  it("isSupported() is false before any provider is registered", () => {
    const dispatcher = new KnowledgeSearchStrategy(new KnowledgeRetrievalRegistry());
    expect(dispatcher.isSupported(KnowledgeSearchMode.KEYWORD)).toBe(false);
  });

  it("registers a provider keyed by its mode", () => {
    const dispatcher = new KnowledgeSearchStrategy(new KnowledgeRetrievalRegistry());
    dispatcher.register({
      id: "ignored",
      mode: KnowledgeSearchMode.KEYWORD,
      execute: async () => [],
    });
    expect(dispatcher.isSupported(KnowledgeSearchMode.KEYWORD)).toBe(true);
  });

  it("execute() dispatches to the registered provider", async () => {
    const dispatcher = new KnowledgeSearchStrategy(new KnowledgeRetrievalRegistry());
    const fakeResult = { assetId: "a-1" } as never;
    dispatcher.register({
      id: "ignored",
      mode: KnowledgeSearchMode.KEYWORD,
      execute: async () => [fakeResult],
    });
    const results = await dispatcher.execute(
      KnowledgeSearchMode.KEYWORD,
      query,
      contextFixture(),
      {} as never,
    );
    expect(results).toEqual([fakeResult]);
  });

  it("execute() throws SearchStrategyNotFoundException when nothing is registered", async () => {
    const dispatcher = new KnowledgeSearchStrategy(new KnowledgeRetrievalRegistry());
    await expect(
      dispatcher.execute(KnowledgeSearchMode.KEYWORD, query, contextFixture(), {} as never),
    ).rejects.toThrow(SearchStrategyNotFoundException);
  });

  it("replacing a provider for the same mode overwrites the previous one", () => {
    const dispatcher = new KnowledgeSearchStrategy(new KnowledgeRetrievalRegistry());
    dispatcher.register({ id: "a", mode: KnowledgeSearchMode.KEYWORD, execute: async () => [] });
    expect(() =>
      dispatcher.register({ id: "b", mode: KnowledgeSearchMode.KEYWORD, execute: async () => [] }),
    ).not.toThrow();
  });
});
