import { describe, expect, it } from "vitest";

import { EMPTY_KNOWLEDGE_FILTER_SET } from "../../src/domain/knowledge-filter-set.js";
import { KnowledgeQueryType } from "../../src/domain/knowledge-query-type.js";
import { KnowledgeSearchMode } from "../../src/domain/knowledge-search-mode.js";
import { RetrievalPermissionDeniedException } from "../../src/errors/retrieval-permission-denied-exception.js";
import { RetrievalPolicyViolationException } from "../../src/errors/retrieval-policy-violation-exception.js";
import { RetrievalValidationException } from "../../src/errors/retrieval-validation-exception.js";
import { KnowledgeRetrievalMetrics } from "../../src/metrics/knowledge-retrieval-metrics.js";
import { KnowledgeSearchPipeline } from "../../src/pipeline/knowledge-search-pipeline.js";
import { KnowledgeRankingEngine } from "../../src/ranking/knowledge-ranking-engine.js";
import { KnowledgeRetrievalRegistry } from "../../src/registry/knowledge-retrieval-registry.js";
import { KnowledgeResolver } from "../../src/resolver/knowledge-resolver.js";
import { KnowledgeSearchStrategy } from "../../src/strategy/knowledge-search-strategy.js";
import { KnowledgeRetrievalValidator } from "../../src/validator/knowledge-retrieval-validator.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { engineFixture } from "../helpers/engine-fixture.js";
import { resultFixture } from "../helpers/result-fixture.js";

async function pipelineFixture(options: Parameters<typeof buildPipeline>[1] = {}) {
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
  return buildPipeline(resolver, options, searchStrategy, registry, asset);
}

function buildPipeline(
  resolver: KnowledgeResolver,
  options: {
    queryPermissionChecker?: { check: () => boolean | Promise<boolean> };
    queryPolicyChecker?: { check: () => boolean | Promise<boolean> };
    resultPermissionChecker?: { check: () => boolean | Promise<boolean> };
  } = {},
  searchStrategy?: KnowledgeSearchStrategy,
  registry?: KnowledgeRetrievalRegistry,
  asset?: Awaited<ReturnType<typeof engineFixture>>["asset"],
) {
  const reg = registry ?? new KnowledgeRetrievalRegistry();
  const strategy = searchStrategy ?? new KnowledgeSearchStrategy(reg);
  const pipeline = new KnowledgeSearchPipeline(
    new KnowledgeRetrievalValidator(),
    strategy,
    new KnowledgeRankingEngine(reg),
    resolver,
    new KnowledgeRetrievalMetrics(),
    options,
  );
  return { pipeline, asset };
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

describe("KnowledgeSearchPipeline", () => {
  it("runs all 9 stages and returns paged results", async () => {
    const { pipeline } = await pipelineFixture();
    const output = await pipeline.run({ query: queryFixture(), context: contextFixture() });
    expect(output.results).toHaveLength(1);
    expect(output.permissionRejectCount).toBe(0);
    expect(output.policyRejectCount).toBe(0);
  });

  it("throws RetrievalValidationException for an invalid query", async () => {
    const { pipeline } = await pipelineFixture();
    await expect(
      pipeline.run({ query: queryFixture({ searchModes: [] }), context: contextFixture() }),
    ).rejects.toThrow(RetrievalValidationException);
  });

  it("throws RetrievalPermissionDeniedException when the query-level permission checker rejects", async () => {
    const { pipeline } = await pipelineFixture({ queryPermissionChecker: { check: () => false } });
    await expect(
      pipeline.run({ query: queryFixture(), context: contextFixture() }),
    ).rejects.toThrow(RetrievalPermissionDeniedException);
  });

  it("throws RetrievalPolicyViolationException when the query-level policy checker rejects", async () => {
    const { pipeline } = await pipelineFixture({ queryPolicyChecker: { check: () => false } });
    await expect(
      pipeline.run({ query: queryFixture(), context: contextFixture() }),
    ).rejects.toThrow(RetrievalPolicyViolationException);
  });

  it("filters out results the result-level permission checker rejects", async () => {
    const { pipeline } = await pipelineFixture({ resultPermissionChecker: { check: () => false } });
    const output = await pipeline.run({ query: queryFixture(), context: contextFixture() });
    expect(output.results).toEqual([]);
    expect(output.permissionRejectCount).toBe(1);
  });

  it("applies limit/offset to the final result page", async () => {
    const { pipeline } = await pipelineFixture();
    const output = await pipeline.run({
      query: queryFixture({ limit: 0 }),
      context: contextFixture(),
    });
    expect(output.results).toEqual([]);
  });

  it("annotates the context with a resolved namespace scope", async () => {
    const { pipeline } = await pipelineFixture();
    const context = contextFixture();
    await pipeline.run({ query: queryFixture(), context });
    expect(context.variables.namespaceScope).toEqual({
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
    });
  });
});
