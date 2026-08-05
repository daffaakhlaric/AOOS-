import { describe, expect, it } from "vitest";

import * as PublicApi from "../src/index.js";

const REQUIRED_PUBLIC_API_NAMES = [
  "KnowledgeRetrieval",
  "KnowledgeRetrievalSystem",
  "KnowledgeRetriever",
  "KnowledgeQuery",
  "KnowledgeQueryContext",
  "KnowledgeQuerySession",
  "KnowledgeResolver",
  "KnowledgeFilter",
  "KnowledgeSearchPipeline",
  "KnowledgeSearchStrategy",
  "KnowledgeRankingEngine",
  "KnowledgePermissionResolver",
  "KnowledgePolicyResolver",
  "KnowledgeSearchFactory",
  "KnowledgeRetrievalRegistry",
  "KnowledgeRetrievalValidator",
  "KnowledgeRetrievalMetrics",
  "KnowledgeRetrievalHealth",
  "KnowledgeRetrievalMonitor",
  "KnowledgeRetrievalEvents",
  "KnowledgeRetrievalStatistics",
];

describe("public API", () => {
  it.each(
    REQUIRED_PUBLIC_API_NAMES.filter(
      (name) => !["KnowledgeQuery", "KnowledgeQueryContext"].includes(name),
    ),
  )("exports %s as a class/value", (name) => {
    expect((PublicApi as Record<string, unknown>)[name]).toBeDefined();
  });

  it("exports the knowledgeQuerySchema/KnowledgeQueryContext schemas (type-only for the type, value for the schema)", () => {
    expect(PublicApi.knowledgeQuerySchema).toBeDefined();
    expect(PublicApi.knowledgeQueryContextSchema).toBeDefined();
  });

  it("exports the 21 named Public API members as either a value or a schema companion", () => {
    for (const name of REQUIRED_PUBLIC_API_NAMES) {
      const hasValueExport = (PublicApi as Record<string, unknown>)[name] !== undefined;
      const hasSchemaCompanion =
        name === "KnowledgeQuery"
          ? PublicApi.knowledgeQuerySchema !== undefined
          : name === "KnowledgeQueryContext"
            ? PublicApi.knowledgeQueryContextSchema !== undefined
            : false;
      expect(hasValueExport || hasSchemaCompanion).toBe(true);
    }
  });
});
