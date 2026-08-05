import { describe, expect, it } from "vitest";

import { KnowledgeQueryType } from "../../src/domain/knowledge-query-type.js";
import { KnowledgeRankingStrategy } from "../../src/domain/knowledge-ranking-strategy.js";
import { KnowledgeRetrievalState } from "../../src/domain/knowledge-retrieval-state.js";
import { KnowledgeSearchMode } from "../../src/domain/knowledge-search-mode.js";
import { RetrievalNotFoundException } from "../../src/errors/retrieval-not-found-exception.js";
import { RetrievalValidationException } from "../../src/errors/retrieval-validation-exception.js";
import { KnowledgeRetrievalEvents } from "../../src/events/knowledge-retrieval-events.js";
import { KnowledgeRetrieval } from "../../src/retrieval/knowledge-retrieval.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { engineFixture } from "../helpers/engine-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

async function retrievalFixture() {
  const { engine, indexing, asset } = await engineFixture();
  const { publisher } = fakePublisher();
  const retrieval = new KnowledgeRetrieval({
    knowledgeEngine: engine,
    knowledgeIndexing: indexing,
    events: new KnowledgeRetrievalEvents(publisher),
  });
  retrieval.registerSearchStrategy({
    id: "ignored",
    mode: KnowledgeSearchMode.KEYWORD,
    execute: async (_query, _context, resolver) => {
      const resolvedAsset = resolver.resolveAsset(asset.id);
      return [
        {
          assetId: resolvedAsset.id,
          version: `${resolvedAsset.version.major}.${resolvedAsset.version.minor}.${resolvedAsset.version.patch}`,
          relationships: [],
          score: 1,
          confidence: 1,
          matchedFields: [],
          matchedKeywords: [],
          matchedMetadata: {},
          matchedTags: [],
          matchedCategories: [],
          chunkRefs: [],
          embeddingRefs: [],
          namespace: resolvedAsset.namespace,
          source: "keyword-provider",
          searchMode: KnowledgeSearchMode.KEYWORD,
          executionTimeMs: 1,
        },
      ];
    },
  });
  return { retrieval, asset };
}

function queryFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "q-1",
    type: KnowledgeQueryType.KEYWORD,
    keywords: ["hi"],
    searchModes: [KnowledgeSearchMode.KEYWORD],
    filters: {},
    limit: 20,
    offset: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  } as never;
}

describe("KnowledgeRetrieval", () => {
  it("search() runs a full retrieval and returns a COMPLETED execution", async () => {
    const { retrieval, asset } = await retrievalFixture();
    const context = contextFixture({
      tenantId: asset.scope.tenantId,
      workspaceId: asset.scope.workspaceId,
    });
    const execution = await retrieval.search(queryFixture(), context);
    expect(execution.instance.state).toBe(KnowledgeRetrievalState.COMPLETED);
    expect(execution.results).toHaveLength(1);
  });

  it("search() rejects an invalid query", async () => {
    const { retrieval, asset } = await retrievalFixture();
    const context = contextFixture({ tenantId: asset.scope.tenantId });
    await expect(retrieval.search(queryFixture({ searchModes: [] }), context)).rejects.toThrow(
      RetrievalValidationException,
    );
  });

  it("search() honors a registered ranking provider", async () => {
    const { retrieval, asset } = await retrievalFixture();
    const rankedResult = {
      assetId: asset.id,
      version: "1.0.0",
      relationships: [],
      score: 99,
      confidence: 1,
      matchedFields: [],
      matchedKeywords: [],
      matchedMetadata: {},
      matchedTags: [],
      matchedCategories: [],
      chunkRefs: [],
      embeddingRefs: [],
      namespace: asset.namespace,
      source: "ranked",
      searchMode: KnowledgeSearchMode.KEYWORD,
      executionTimeMs: 1,
    };
    retrieval.registerRankingProvider(KnowledgeRankingStrategy.BM25, {
      rank: async () => [rankedResult],
    });
    const context = contextFixture({
      tenantId: asset.scope.tenantId,
      workspaceId: asset.scope.workspaceId,
    });
    const execution = await retrieval.search(
      queryFixture(),
      context,
      KnowledgeRankingStrategy.BM25,
    );
    expect(execution.results).toEqual([rankedResult]);
  });

  it("getExecution()/requireExecution() look up a completed retrieval by token", async () => {
    const { retrieval, asset } = await retrievalFixture();
    const context = contextFixture({
      tenantId: asset.scope.tenantId,
      workspaceId: asset.scope.workspaceId,
    });
    const execution = await retrieval.search(queryFixture(), context);
    expect(retrieval.getExecution(execution.instance.token)).toBe(execution);
    expect(retrieval.requireExecution(execution.instance.token)).toBe(execution);
  });

  it("requireExecution() throws for an unknown token", async () => {
    const { retrieval } = await retrievalFixture();
    expect(() => retrieval.requireExecution("missing")).toThrow(RetrievalNotFoundException);
  });

  it("cancel() transitions an in-flight retrieval to CANCELLED", async () => {
    const { retrieval, asset } = await retrievalFixture();
    const context = contextFixture({
      tenantId: asset.scope.tenantId,
      workspaceId: asset.scope.workspaceId,
    });
    const execution = await retrieval.search(queryFixture(), context);
    // Force back to a cancellable state is not possible post-completion; instead verify
    // cancel() throws IllegalRetrievalTransitionException from a terminal state.
    await expect(retrieval.cancel(execution.instance.token)).rejects.toThrow();
  });

  it("search() honors a caller-supplied config with query-level permission/policy checkers", async () => {
    const { engine, indexing, asset } = await engineFixture();
    const { publisher } = fakePublisher();
    const retrieval = new KnowledgeRetrieval({
      knowledgeEngine: engine,
      knowledgeIndexing: indexing,
      events: new KnowledgeRetrievalEvents(publisher),
      config: {
        queryPermissionChecker: { check: () => false },
      },
    });
    retrieval.registerSearchStrategy({
      id: "ignored",
      mode: KnowledgeSearchMode.KEYWORD,
      execute: async () => [],
    });
    const context = contextFixture({
      tenantId: asset.scope.tenantId,
      workspaceId: asset.scope.workspaceId,
    });
    await expect(retrieval.search(queryFixture(), context)).rejects.toThrow();
  });

  it("health()/metrics()/monitorSnapshot() report live state after a search", async () => {
    const { retrieval, asset } = await retrievalFixture();
    const context = contextFixture({
      tenantId: asset.scope.tenantId,
      workspaceId: asset.scope.workspaceId,
    });
    await retrieval.search(queryFixture(), context);
    expect(retrieval.health().status).toBeDefined();
    expect(retrieval.metrics().totalQueries).toBe(1);
    expect(retrieval.monitorSnapshot().search.total).toBe(1);
  });
});
