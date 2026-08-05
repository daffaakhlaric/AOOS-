import { describe, expect, it } from "vitest";

import { KnowledgeQueryType } from "../../src/domain/knowledge-query-type.js";
import { KnowledgeRankingStrategy } from "../../src/domain/knowledge-ranking-strategy.js";
import { KnowledgeSearchMode } from "../../src/domain/knowledge-search-mode.js";
import { KnowledgeSearchFactory } from "../../src/factory/knowledge-search-factory.js";

describe("KnowledgeSearchFactory", () => {
  it("composes all 6 sub-factories", () => {
    const factory = new KnowledgeSearchFactory();
    expect(factory.query).toBeDefined();
    expect(factory.session).toBeDefined();
    expect(factory.result).toBeDefined();
    expect(factory.ranking).toBeDefined();
    expect(factory.filter).toBeDefined();
    expect(factory.context).toBeDefined();
  });
});

describe("KnowledgeQueryFactory", () => {
  it("generates an id, createdAt, and defaults limit/offset", () => {
    const factory = new KnowledgeSearchFactory();
    const query = factory.query.create({
      type: KnowledgeQueryType.KEYWORD,
      searchModes: [KnowledgeSearchMode.KEYWORD],
    });
    expect(query.id.length).toBeGreaterThan(0);
    expect(query.limit).toBe(20);
    expect(query.offset).toBe(0);
    expect(query.keywords).toEqual([]);
  });

  it("preserves supplied text/keywords/filters/limit/offset", () => {
    const factory = new KnowledgeSearchFactory();
    const query = factory.query.create({
      type: KnowledgeQueryType.QUESTION,
      searchModes: [KnowledgeSearchMode.KEYWORD],
      text: "what is retention",
      keywords: ["retention"],
      limit: 5,
      offset: 10,
    });
    expect(query.text).toBe("what is retention");
    expect(query.keywords).toEqual(["retention"]);
    expect(query.limit).toBe(5);
    expect(query.offset).toBe(10);
  });
});

describe("KnowledgeSessionFactory", () => {
  it("produces an unregistered OPEN session record", () => {
    const factory = new KnowledgeSearchFactory();
    const record = factory.session.create("rtok_1", "holder-1");
    expect(record.state).toBe("open");
    expect(record.token).toBe("rtok_1");
  });
});

describe("KnowledgeResultFactory", () => {
  it("defaults score/confidence/executionTimeMs to 0 and arrays to []", () => {
    const factory = new KnowledgeSearchFactory();
    const result = factory.result.create({
      assetId: "asset-1",
      version: "1.0.0",
      namespace: "ns",
      searchMode: KnowledgeSearchMode.KEYWORD,
      source: "provider",
    });
    expect(result.score).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.executionTimeMs).toBe(0);
    expect(result.matchedFields).toEqual([]);
    expect(result.chunkRefs).toEqual([]);
  });

  it("preserves supplied optional fields", () => {
    const factory = new KnowledgeSearchFactory();
    const result = factory.result.create({
      assetId: "asset-1",
      version: "1.0.0",
      namespace: "ns",
      searchMode: KnowledgeSearchMode.KEYWORD,
      source: "provider",
      score: 0.5,
      confidence: 0.7,
      matchedKeywords: ["hi"],
      policy: "policy-1",
      permission: "read",
    });
    expect(result.score).toBe(0.5);
    expect(result.matchedKeywords).toEqual(["hi"]);
    expect(result.policy).toBe("policy-1");
    expect(result.permission).toBe("read");
  });
});

describe("KnowledgeRankingFactory", () => {
  it("pairs a strategy with a provider", () => {
    const factory = new KnowledgeSearchFactory();
    const provider = { id: "bm25-provider", rank: async (results: unknown) => results };
    const registration = factory.ranking.create(KnowledgeRankingStrategy.BM25, provider as never);
    expect(registration.strategy).toBe(KnowledgeRankingStrategy.BM25);
    expect(registration.provider).toBe(provider);
  });
});

describe("KnowledgeFilterFactory", () => {
  it("merges overrides onto the empty default", () => {
    const factory = new KnowledgeSearchFactory();
    const filters = factory.filter.create({ workspaceId: "workspace-1" });
    expect(filters).toEqual({ workspaceId: "workspace-1" });
  });

  it("returns an empty filter set with no overrides", () => {
    const factory = new KnowledgeSearchFactory();
    expect(factory.filter.create()).toEqual({});
  });
});

describe("KnowledgeSearchContextFactory", () => {
  it("wraps createKnowledgeQueryContext()", () => {
    const factory = new KnowledgeSearchFactory();
    const context = factory.context.create({ tenantId: "tenant-1" });
    expect(context.tenantId).toBe("tenant-1");
    expect(context.token.length).toBeGreaterThan(0);
  });
});
