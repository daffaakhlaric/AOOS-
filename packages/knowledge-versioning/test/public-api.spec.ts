import { describe, expect, it } from "vitest";

import * as PublicApi from "../src/index.js";

const EXPECTED_TOP_LEVEL_EXPORTS = [
  "KnowledgeVersioning",
  "KnowledgeVersion",
  "KnowledgeVersionManager",
  "KnowledgeVersionRegistry",
  "KnowledgeVersionResolver",
  "KnowledgeVersionValidator",
  "KnowledgeVersionPipeline",
  "KnowledgeVersionMiddleware",
  "KnowledgeVersionFactory",
  "KnowledgeVersionSession",
  "KnowledgeVersionLifecycle",
  "KnowledgeVersionStateMachine",
  "KnowledgeVersionEvents",
  "KnowledgeVersionMetrics",
  "KnowledgeVersionHealth",
  "KnowledgeVersionMonitoring",
  "KnowledgeVersionStatistics",
  "KnowledgeVersionSystem",
];

describe("public API", () => {
  it.each(EXPECTED_TOP_LEVEL_EXPORTS)("exports %s", (name) => {
    expect(Reflect.has(PublicApi, name)).toBe(true);
    expect((PublicApi as Record<string, unknown>)[name]).toBeDefined();
  });

  it("does not export internal validator-stage classes by design intent, but exports them for reuse consistent with knowledge-source-manager", () => {
    expect(PublicApi.IdentityValidator).toBeTruthy();
  });

  it("exports the KnowledgeVersionRegistryBucket enum with 8 members", () => {
    expect(Object.values(PublicApi.KnowledgeVersionRegistryBucket)).toHaveLength(8);
  });

  it("exports the KnowledgeVersionEventType enum with 11 members", () => {
    expect(Object.values(PublicApi.KnowledgeVersionEventType)).toHaveLength(11);
  });

  it("exports token helpers", () => {
    expect(typeof PublicApi.generateKnowledgeVersionToken).toBe("function");
    expect(typeof PublicApi.isKnowledgeVersionToken).toBe("function");
  });

  it("exports createKnowledgeVersionContext", () => {
    expect(typeof PublicApi.createKnowledgeVersionContext).toBe("function");
  });
});
