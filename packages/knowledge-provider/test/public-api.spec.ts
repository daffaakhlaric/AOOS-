import { describe, expect, it } from "vitest";

import * as PublicApi from "../src/index.js";

const REQUIRED_PUBLIC_API_NAMES = [
  "KnowledgeProvider",
  "KnowledgeProviderSystem",
  "KnowledgeProviderRegistry",
  "KnowledgeProviderResolver",
  "KnowledgeProviderManager",
  "KnowledgeProviderFactory",
  "KnowledgeProviderContext",
  "KnowledgeProviderSession",
  "KnowledgeProviderValidator",
  "KnowledgeProviderPipeline",
  "KnowledgeProviderLifecycle",
  "KnowledgeProviderStateMachine",
  "KnowledgeProviderMetrics",
  "KnowledgeProviderHealth",
  "KnowledgeProviderMonitor",
  "KnowledgeProviderEvents",
  "KnowledgeProviderStatistics",
  "KnowledgeProviderCapabilities",
  "KnowledgeProviderMetadata",
  "KnowledgeProviderPolicy",
  "KnowledgeProviderConfiguration",
];

const SCHEMA_ONLY_NAMES: Record<string, string> = {
  KnowledgeProviderContext: "knowledgeProviderContextSchema",
};

describe("public API", () => {
  it("exports the 21 named Public API members as either a value or a schema companion", () => {
    for (const name of REQUIRED_PUBLIC_API_NAMES) {
      const hasValueExport = (PublicApi as Record<string, unknown>)[name] !== undefined;
      const schemaName = SCHEMA_ONLY_NAMES[name];
      const hasSchemaCompanion = schemaName
        ? (PublicApi as Record<string, unknown>)[schemaName] !== undefined
        : false;
      expect(hasValueExport || hasSchemaCompanion).toBe(true);
    }
  });

  it.each(REQUIRED_PUBLIC_API_NAMES.filter((name) => !(name in SCHEMA_ONLY_NAMES)))(
    "exports %s as a class/value",
    (name) => {
      expect((PublicApi as Record<string, unknown>)[name]).toBeDefined();
    },
  );

  it("exports the schema companion for the type-only Context Public API name", () => {
    expect(PublicApi.knowledgeProviderContextSchema).toBeDefined();
  });

  it("exports the 28 built-in Provider Definitions", () => {
    expect(PublicApi.BUILT_IN_PROVIDER_DEFINITIONS).toHaveLength(28);
  });
});
