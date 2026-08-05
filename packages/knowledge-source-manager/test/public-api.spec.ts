import { describe, expect, it } from "vitest";

import * as PublicApi from "../src/index.js";

const NAMED_PUBLIC_API = [
  "KnowledgeSourceManager",
  "KnowledgeSourceManagerSystem",
  "KnowledgeSource",
  "KnowledgeSourceRegistry",
  "KnowledgeSourceResolver",
  "KnowledgeSourceFactory",
  "KnowledgeSourceSession",
  "KnowledgeSourceValidator",
  "KnowledgeSourcePipeline",
  "KnowledgeSourceLifecycle",
  "KnowledgeSourceStateMachine",
  "KnowledgeSourceMetrics",
  "KnowledgeSourceHealth",
  "KnowledgeSourceMonitor",
  "KnowledgeSourceEvents",
  "KnowledgeSourceStatistics",
  "KnowledgeSourceConfiguration",
  "KnowledgeSourcePolicy",
  "KnowledgeSourcePermission",
  "KnowledgeSourceScheduler",
  "KnowledgeSourceCatalog",
];

describe("public API surface", () => {
  it("exports every named class from the prompt's Public API list (KnowledgeSourceContext is a type, verified separately)", () => {
    for (const name of NAMED_PUBLIC_API) {
      expect(PublicApi).toHaveProperty(name);
      expect(typeof (PublicApi as Record<string, unknown>)[name]).toBe("function");
    }
  });

  it("exports supporting factory sub-classes", () => {
    expect(PublicApi.KnowledgeSourceContextFactory).toBeDefined();
    expect(PublicApi.KnowledgeSourceSessionFactory).toBeDefined();
    expect(PublicApi.KnowledgeSourceMetadataFactory).toBeDefined();
    expect(PublicApi.KnowledgeSourceConfigurationFactory).toBeDefined();
    expect(PublicApi.KnowledgeSourceStatisticsFactory).toBeDefined();
  });

  it("exports every validator stage", () => {
    expect(PublicApi.SourceIdValidator).toBeDefined();
    expect(PublicApi.SourceNameValidator).toBeDefined();
    expect(PublicApi.ProviderReferenceValidator).toBeDefined();
    expect(PublicApi.CategoryValidator).toBeDefined();
    expect(PublicApi.ConfigurationValidator).toBeDefined();
    expect(PublicApi.TenantValidator).toBeDefined();
    expect(PublicApi.ExecutionTokenValidator).toBeDefined();
  });

  it("exports the domain enums and schemas", () => {
    expect(PublicApi.KnowledgeSourceCategory).toBeDefined();
    expect(PublicApi.KnowledgeSourceState).toBeDefined();
    expect(PublicApi.knowledgeSourceMetadataRecordSchema).toBeDefined();
  });

  it("exports the error hierarchy", () => {
    expect(PublicApi.KnowledgeSourceException).toBeDefined();
    expect(PublicApi.SourceNotFoundException).toBeDefined();
  });

  it("exports the token helpers", () => {
    expect(PublicApi.generateKnowledgeSourceToken).toBeDefined();
    expect(PublicApi.isKnowledgeSourceToken).toBeDefined();
  });

  it("exports the Registry bucket enum and Event type enum", () => {
    expect(PublicApi.KnowledgeSourceRegistryBucket).toBeDefined();
    expect(PublicApi.KnowledgeSourceEventType).toBeDefined();
  });

  it("exports the Schedule mode enum", () => {
    expect(PublicApi.KnowledgeSourceScheduleMode).toBeDefined();
  });

  it("exports the Middleware Pipeline", () => {
    expect(PublicApi.KnowledgeSourceMiddlewarePipeline).toBeDefined();
  });
});
