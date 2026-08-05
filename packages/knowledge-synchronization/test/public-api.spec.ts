import { describe, expect, it } from "vitest";

import * as PublicApi from "../src/index.js";

const REQUIRED_PUBLIC_API_NAMES = [
  "KnowledgeSynchronization",
  "KnowledgeSynchronizationSystem",
  "KnowledgeSynchronizationManager",
  "KnowledgeSynchronizationJob",
  "KnowledgeSynchronizationSession",
  "KnowledgeSynchronizationContext",
  "KnowledgeSynchronizationRegistry",
  "KnowledgeSynchronizationResolver",
  "KnowledgeSynchronizationPipeline",
  "KnowledgeSynchronizationValidator",
  "KnowledgeSynchronizationScheduler",
  "KnowledgeSynchronizationEvents",
  "KnowledgeSynchronizationMetrics",
  "KnowledgeSynchronizationHealth",
  "KnowledgeSynchronizationMonitor",
  "KnowledgeSynchronizationFactory",
  "KnowledgeSynchronizationStatistics",
  "KnowledgeSynchronizationStateMachine",
  "KnowledgeSynchronizationLifecycle",
  "KnowledgeSynchronizationPolicy",
];

const SCHEMA_ONLY_NAMES: Record<string, string> = {
  KnowledgeSynchronizationJob: "knowledgeSynchronizationJobSchema",
  KnowledgeSynchronizationContext: "knowledgeSynchronizationContextSchema",
};

describe("public API", () => {
  it("exports the 20 named Public API members as either a value or a schema companion", () => {
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

  it("exports the schema companions for type-only Public API names", () => {
    expect(PublicApi.knowledgeSynchronizationJobSchema).toBeDefined();
    expect(PublicApi.knowledgeSynchronizationContextSchema).toBeDefined();
  });
});
