import { describe, expect, it } from "vitest";

import { EMPTY_KNOWLEDGE_FILTER_SET } from "../../src/domain/knowledge-filter-set.js";
import { KnowledgeQueryType } from "../../src/domain/knowledge-query-type.js";
import { KnowledgeRetrievalState } from "../../src/domain/knowledge-retrieval-state.js";
import { KnowledgeSearchMode } from "../../src/domain/knowledge-search-mode.js";
import { KnowledgeRetrievalEvents } from "../../src/events/knowledge-retrieval-events.js";
import { KnowledgeRetrievalManager } from "../../src/manager/knowledge-retrieval-manager.js";
import { KnowledgeRetrievalMetrics } from "../../src/metrics/knowledge-retrieval-metrics.js";
import { KnowledgeSearchPipeline } from "../../src/pipeline/knowledge-search-pipeline.js";
import { KnowledgeRankingEngine } from "../../src/ranking/knowledge-ranking-engine.js";
import { KnowledgeRetrievalRegistry } from "../../src/registry/knowledge-retrieval-registry.js";
import { KnowledgeResolver } from "../../src/resolver/knowledge-resolver.js";
import { KnowledgeRetriever } from "../../src/retriever/knowledge-retriever.js";
import { KnowledgeRetrievalStateMachine } from "../../src/state-machine/knowledge-retrieval-state-machine.js";
import { KnowledgeSearchStrategy } from "../../src/strategy/knowledge-search-strategy.js";
import { KnowledgeRetrievalValidator } from "../../src/validator/knowledge-retrieval-validator.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { engineFixture } from "../helpers/engine-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";
import { resultFixture } from "../helpers/result-fixture.js";

async function retrieverFixture() {
  const { engine, indexing, asset } = await engineFixture();
  const resolver = new KnowledgeResolver(
    engine.repository,
    engine.relationshipEngine,
    engine.policyEngine,
    engine.permissionEngine,
    engine.versionEngine,
    engine.templateEngine,
    indexing.resolver,
  );
  const registry = new KnowledgeRetrievalRegistry();
  const searchStrategy = new KnowledgeSearchStrategy(registry);
  searchStrategy.register({
    id: "ignored",
    mode: KnowledgeSearchMode.KEYWORD,
    execute: async () => [resultFixture(asset)],
  });
  const metrics = new KnowledgeRetrievalMetrics();
  const pipeline = new KnowledgeSearchPipeline(
    new KnowledgeRetrievalValidator(),
    searchStrategy,
    new KnowledgeRankingEngine(registry),
    resolver,
    metrics,
  );
  const manager = new KnowledgeRetrievalManager();
  const { publisher } = fakePublisher();
  const retriever = new KnowledgeRetriever(
    new KnowledgeRetrievalStateMachine(),
    manager,
    pipeline,
    metrics,
    new KnowledgeRetrievalEvents(publisher),
  );
  return { retriever, manager, asset };
}

function queryFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "q-1",
    type: KnowledgeQueryType.KEYWORD,
    keywords: ["hi"],
    searchModes: [KnowledgeSearchMode.KEYWORD],
    filters: EMPTY_KNOWLEDGE_FILTER_SET,
    limit: 20,
    offset: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  } as never;
}

describe("KnowledgeRetriever", () => {
  it("retrieve() completes and registers the execution in the manager", async () => {
    const { retriever, manager, asset } = await retrieverFixture();
    const context = contextFixture({
      tenantId: asset.scope.tenantId,
      workspaceId: asset.scope.workspaceId,
    });
    const execution = await retriever.retrieve({ query: queryFixture(), context });
    expect(execution.instance.state).toBe(KnowledgeRetrievalState.COMPLETED);
    expect(manager.get(context.token)).toBe(execution);
  });

  it("retrieve() transitions to FAILED and rethrows on pipeline failure", async () => {
    const { retriever, asset } = await retrieverFixture();
    const context = contextFixture({
      tenantId: asset.scope.tenantId,
      workspaceId: asset.scope.workspaceId,
    });
    await expect(
      retriever.retrieve({ query: queryFixture({ searchModes: [] }), context }),
    ).rejects.toThrow();
  });

  it("cancel() transitions a still-open retrieval straight to CANCELLED", async () => {
    const { retriever, manager } = await retrieverFixture();
    const context = contextFixture();
    manager.register({
      instance: {
        id: "i-1",
        token: context.token,
        queryId: "q-1",
        tenantId: context.tenantId,
        state: KnowledgeRetrievalState.CREATED,
        resultCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      context,
      query: queryFixture(),
      results: [],
      history: [],
    });
    const cancelled = await retriever.cancel(context.token);
    expect(cancelled.instance.state).toBe(KnowledgeRetrievalState.CANCELLED);
  });
});
