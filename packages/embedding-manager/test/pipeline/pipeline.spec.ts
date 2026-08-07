import { describe, expect, it } from "vitest";

import { EmbeddingModelName } from "../../src/domain/embedding-model-name.js";
import { EmbeddingProviderType } from "../../src/domain/embedding-provider-type.js";
import { EmbeddingState } from "../../src/domain/embedding-state.js";
import { EmbeddingCheckException } from "../../src/errors/embedding-check-exception.js";
import { EmbeddingConfigurationException } from "../../src/errors/embedding-configuration-exception.js";
import { EmbeddingModelException } from "../../src/errors/embedding-model-exception.js";
import { EmbeddingNamespaceException } from "../../src/errors/embedding-namespace-exception.js";
import { EmbeddingProviderException } from "../../src/errors/embedding-provider-exception.js";
import { EmbeddingMetrics } from "../../src/metrics/embedding-metrics.js";
import { EmbeddingPipeline } from "../../src/pipeline/embedding-pipeline.js";
import { EmbeddingRegistryBucket } from "../../src/registry/embedding-registry-bucket.js";
import { EmbeddingRegistry } from "../../src/registry/embedding-registry.js";
import { EmbeddingResolver } from "../../src/resolver/embedding-resolver.js";
import { EmbeddingValidator } from "../../src/validator/embedding-validator.js";
import { executionFixture } from "../helpers/execution-fixture.js";

function makePipeline() {
  const registry = new EmbeddingRegistry();
  const resolver = new EmbeddingResolver(registry);
  const metrics = new EmbeddingMetrics();
  const validator = new EmbeddingValidator();
  const pipeline = new EmbeddingPipeline(validator, metrics, registry, resolver);
  return { pipeline, registry, resolver, metrics };
}

function registerProviderAndModel(registry: EmbeddingRegistry, tenantId = "tenant-1") {
  registry.register(EmbeddingRegistryBucket.PROVIDER, {
    id: `${tenantId}::${EmbeddingProviderType.OPENAI}`,
    providerId: `${tenantId}::${EmbeddingProviderType.OPENAI}`,
    name: "OpenAI",
    type: EmbeddingProviderType.OPENAI,
    tenantId,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  registry.register(EmbeddingRegistryBucket.MODEL, {
    id: `${tenantId}::${EmbeddingModelName.TEXT_EMBEDDING_3_SMALL}`,
    modelId: `${tenantId}::${EmbeddingModelName.TEXT_EMBEDDING_3_SMALL}`,
    name: EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
    providerType: EmbeddingProviderType.OPENAI,
    tenantId,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

describe("EmbeddingPipeline", () => {
  it("throws EmbeddingCheckException when Stage 1 Validation fails", () => {
    const { pipeline } = makePipeline();
    const execution = executionFixture({
      metadata: { ...executionFixture().metadata, title: "" },
    });
    expect(() => pipeline.run({ execution, operation: "test" })).toThrow(EmbeddingCheckException);
  });

  it("throws EmbeddingProviderException when the Provider is not registered", () => {
    const { pipeline } = makePipeline();
    expect(() => pipeline.run({ execution: executionFixture(), operation: "test" })).toThrow(
      EmbeddingProviderException,
    );
  });

  it("throws (via the pre-flight Validator) when the resolved Provider is inactive", () => {
    const { pipeline, registry } = makePipeline();
    registerProviderAndModel(registry);
    registry.replace(EmbeddingRegistryBucket.PROVIDER, {
      id: `tenant-1::${EmbeddingProviderType.OPENAI}`,
      providerId: `tenant-1::${EmbeddingProviderType.OPENAI}`,
      name: "OpenAI",
      type: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
      active: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    /* The 12-stage Validator's own ProviderValidator (stage 3) catches this BEFORE
     * Pipeline Stage 2 gets a chance to run its own active-check — a documented
     * defense-in-depth overlap, see docs/005.7N-EMBEDDING-MANAGER-REPORT.md. */
    expect(() => pipeline.run({ execution: executionFixture(), operation: "test" })).toThrow(
      EmbeddingCheckException,
    );
  });

  it("Pipeline Stage 2's own active-check throws EmbeddingProviderException when the Validator does not flag it", () => {
    const { registry, resolver, metrics } = makePipeline();
    registerProviderAndModel(registry);
    registry.replace(EmbeddingRegistryBucket.PROVIDER, {
      id: `tenant-1::${EmbeddingProviderType.OPENAI}`,
      providerId: `tenant-1::${EmbeddingProviderType.OPENAI}`,
      name: "OpenAI",
      type: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
      active: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const alwaysValidValidator = {
      validate: () => ({ valid: true, issues: [] }),
    } as EmbeddingValidator;
    const pipeline = new EmbeddingPipeline(alwaysValidValidator, metrics, registry, resolver);
    expect(() => pipeline.run({ execution: executionFixture(), operation: "test" })).toThrow(
      EmbeddingProviderException,
    );
  });

  it("throws EmbeddingModelException when the Model is not registered", () => {
    const { pipeline, registry } = makePipeline();
    registry.register(EmbeddingRegistryBucket.PROVIDER, {
      id: `tenant-1::${EmbeddingProviderType.OPENAI}`,
      providerId: `tenant-1::${EmbeddingProviderType.OPENAI}`,
      name: "OpenAI",
      type: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(() => pipeline.run({ execution: executionFixture(), operation: "test" })).toThrow(
      EmbeddingModelException,
    );
  });

  it("throws EmbeddingNamespaceException when a declared Namespace is not registered", () => {
    const { pipeline, registry } = makePipeline();
    registerProviderAndModel(registry);
    const execution = executionFixture({
      request: { ...executionFixture().request, namespaceId: "missing-ns" },
    });
    expect(() => pipeline.run({ execution, operation: "test" })).toThrow(
      EmbeddingNamespaceException,
    );
  });

  it("throws EmbeddingConfigurationException when a declared Configuration is not registered", () => {
    const { pipeline, registry } = makePipeline();
    registerProviderAndModel(registry);
    const execution = executionFixture({
      request: { ...executionFixture().request, configurationId: "missing-cfg" },
    });
    expect(() => pipeline.run({ execution, operation: "test" })).toThrow(
      EmbeddingConfigurationException,
    );
  });

  it("resolves Namespace/Configuration when both are registered", () => {
    const { pipeline, registry, resolver } = makePipeline();
    registerProviderAndModel(registry);
    registry.register(EmbeddingRegistryBucket.NAMESPACE, {
      id: "ns-1",
      namespaceId: "ns-1",
      name: "docs",
      tenantId: "tenant-1",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    resolver.registerConfiguration({
      id: "cfg-1",
      configurationId: "cfg-1",
      embeddingId: "embedding-1",
      tenantId: "tenant-1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const execution = executionFixture({
      request: { ...executionFixture().request, namespaceId: "ns-1", configurationId: "cfg-1" },
    });
    const result = pipeline.run({ execution, operation: "test" });
    expect(result.resolvedNamespace?.namespaceId).toBe("ns-1");
    expect(result.configuration?.configurationId).toBe("cfg-1");
  });

  it("stamps metadata.updatedAt (Stage 6)", () => {
    const { pipeline, registry } = makePipeline();
    registerProviderAndModel(registry);
    const result = pipeline.run({ execution: executionFixture(), operation: "test" });
    expect(result.metadata.updatedAt).toBeDefined();
  });

  it("records Metrics (Stage 7): embeddingCount and providerUsage", () => {
    const { pipeline, registry, metrics } = makePipeline();
    registerProviderAndModel(registry);
    pipeline.run({ execution: executionFixture(), operation: "test" });
    const snapshot = metrics.snapshot();
    expect(snapshot.embeddingCount).toBe(1);
    expect(snapshot.providerUsage[EmbeddingProviderType.OPENAI]).toBe(1);
  });

  it("advances the State Machine (Stage 8) when targetState is supplied", () => {
    const { pipeline, registry } = makePipeline();
    registerProviderAndModel(registry);
    const result = pipeline.run({
      execution: executionFixture(),
      operation: "queue",
      targetState: EmbeddingState.QUEUED,
    });
    expect(result.instance.state).toBe(EmbeddingState.QUEUED);
  });

  it("does not transition (no-op, no LifecycleValidator issue) when targetState equals the current state", () => {
    const { pipeline, registry } = makePipeline();
    registerProviderAndModel(registry);
    const result = pipeline.run({
      execution: executionFixture(),
      operation: "noop",
      targetState: EmbeddingState.DRAFT,
    });
    expect(result.history).toHaveLength(0);
  });

  it("appends an Audit entry (Stage 9) and registers it in the AUDIT bucket", () => {
    const { pipeline, registry } = makePipeline();
    registerProviderAndModel(registry);
    const result = pipeline.run({
      execution: executionFixture(),
      operation: "test",
      reason: "because",
    });
    expect(result.auditTrail).toHaveLength(1);
    expect(result.auditTrail[0]!.action).toBe("test");
    expect(result.auditTrail[0]!.details).toBe("because");
    expect(registry.count(EmbeddingRegistryBucket.AUDIT)).toBe(1);
  });

  it("appends a Logging entry (Stage 10)", () => {
    const { pipeline, registry } = makePipeline();
    registerProviderAndModel(registry);
    const result = pipeline.run({ execution: executionFixture(), operation: "test" });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]!.level).toBe("info");
  });

  it("records recordCheck(false) via metrics when Validation fails", () => {
    const { pipeline, metrics } = makePipeline();
    const execution = executionFixture({ metadata: { ...executionFixture().metadata, title: "" } });
    expect(() => pipeline.run({ execution, operation: "test" })).toThrow();
    expect(metrics.snapshot().checkFailureCount).toBe(1);
  });
});
