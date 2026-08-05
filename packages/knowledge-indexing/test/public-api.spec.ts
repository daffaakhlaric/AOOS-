import { describe, expect, it } from "vitest";

import * as PublicApi from "../src/index.js";

const REQUIRED_PUBLIC_API_NAMES = [
  "KnowledgeIndexing",
  "KnowledgeIndexingSystem",
  "KnowledgeIndexer",
  "KnowledgeIndexRegistry",
  "KnowledgeIndexManager",
  "KnowledgeIndexBuilder",
  "KnowledgeIndexValidator",
  "KnowledgeIndexPipeline",
  "knowledgeIndexContextSchema",
  "KnowledgeIndexFactory",
  "KnowledgeIndexMetrics",
  "KnowledgeIndexHealth",
  "KnowledgeIndexMonitor",
  "KnowledgeIndexEvents",
  "KnowledgeIndexScheduler",
  "KnowledgeIndexOptimizer",
  "KnowledgeIndexStatistics",
  "KnowledgeIndexResolver",
] as const;

describe("Public API Test — package barrel", () => {
  it.each(REQUIRED_PUBLIC_API_NAMES)("exports %s", (name) => {
    expect((PublicApi as Record<string, unknown>)[name]).toBeDefined();
  });

  it("exports the Domain/Contracts/Errors surface", () => {
    expect(PublicApi.KnowledgeIndexType).toBeDefined();
    expect(PublicApi.knowledgeIndexEntrySchema).toBeDefined();
    expect(PublicApi.KnowledgeIndexException).toBeDefined();
  });

  it("exports every validator stage class", () => {
    expect(PublicApi.NamespaceValidator).toBeDefined();
    expect(PublicApi.MetadataValidator).toBeDefined();
    expect(PublicApi.RelationshipValidator).toBeDefined();
    expect(PublicApi.PolicyValidator).toBeDefined();
    expect(PublicApi.PermissionValidator).toBeDefined();
    expect(PublicApi.EmbeddingReferenceValidator).toBeDefined();
    expect(PublicApi.DuplicateValidator).toBeDefined();
    expect(PublicApi.ConsistencyValidator).toBeDefined();
  });

  it("declares exactly 18 required Public API names", () => {
    expect(REQUIRED_PUBLIC_API_NAMES).toHaveLength(18);
  });
});
