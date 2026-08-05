import { describe, expect, it } from "vitest";

import * as PublicApi from "../src/index.js";

const REQUIRED_PUBLIC_API_NAMES = [
  "KnowledgeRuntime",
  "KnowledgeRuntimeSystem",
  "knowledgeRuntimeContextSchema",
  "KnowledgeRuntimeSession",
  "KnowledgeRuntimeManager",
  "KnowledgeRuntimeRegistry",
  "KnowledgeRuntimeResolver",
  "KnowledgeRuntimeLoader",
  "KnowledgeRuntimeValidator",
  "KnowledgeRuntimeStateMachine",
  "KnowledgeRuntimeLifecycle",
  "KnowledgeRuntimeMiddleware",
  "KnowledgeRuntimeEvents",
  "KnowledgeRuntimeMetrics",
  "KnowledgeRuntimeHealth",
  "KnowledgeRuntimeMonitor",
  "KnowledgeRuntimeFactory",
] as const;

describe("Public API Test — package barrel", () => {
  it.each(REQUIRED_PUBLIC_API_NAMES)("exports %s", (name) => {
    expect((PublicApi as Record<string, unknown>)[name]).toBeDefined();
  });

  it("exports the Domain/Contracts/Errors/Token surface", () => {
    expect(PublicApi.KnowledgeRuntimeState).toBeDefined();
    expect(PublicApi.knowledgeRuntimeInstanceSchema).toBeDefined();
    expect(PublicApi.KnowledgeRuntimeException).toBeDefined();
    expect(PublicApi.generateKnowledgeRuntimeToken).toBeDefined();
    expect(PublicApi.isKnowledgeRuntimeToken).toBeDefined();
  });

  it("exports every validator stage class", () => {
    expect(PublicApi.RuntimeStateValidator).toBeDefined();
    expect(PublicApi.ContextValidator).toBeDefined();
    expect(PublicApi.RuntimePermissionValidator).toBeDefined();
    expect(PublicApi.RuntimePolicyValidator).toBeDefined();
    expect(PublicApi.RuntimeLifecycleValidator).toBeDefined();
    expect(PublicApi.RuntimeRelationshipValidator).toBeDefined();
    expect(PublicApi.RuntimeNamespaceValidator).toBeDefined();
    expect(PublicApi.RuntimeMetadataValidator).toBeDefined();
    expect(PublicApi.RuntimeTenantValidator).toBeDefined();
    expect(PublicApi.RuntimeWorkspaceValidator).toBeDefined();
    expect(PublicApi.ExecutionTokenValidator).toBeDefined();
  });

  it("exports every middleware stage class", () => {
    expect(PublicApi.ValidationMiddleware).toBeDefined();
    expect(PublicApi.ContextMiddleware).toBeDefined();
    expect(PublicApi.PermissionMiddleware).toBeDefined();
    expect(PublicApi.PolicyMiddleware).toBeDefined();
    expect(PublicApi.TracingMiddleware).toBeDefined();
    expect(PublicApi.MetricsMiddleware).toBeDefined();
    expect(PublicApi.LifecycleMiddleware).toBeDefined();
    expect(PublicApi.LoggingMiddleware).toBeDefined();
  });

  it("exports every factory sub-class", () => {
    expect(PublicApi.RuntimeContextFactory).toBeDefined();
    expect(PublicApi.RuntimeSessionFactory).toBeDefined();
    expect(PublicApi.RuntimeSnapshotFactory).toBeDefined();
    expect(PublicApi.RuntimeMetadataFactory).toBeDefined();
    expect(PublicApi.RuntimeTokenFactory).toBeDefined();
  });
});
