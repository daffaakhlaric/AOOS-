import { describe, expect, it } from "vitest";

import { EmbeddingModelName } from "../../src/domain/embedding-model-name.js";
import { EmbeddingProviderType } from "../../src/domain/embedding-provider-type.js";
import { EmbeddingMetrics } from "../../src/metrics/embedding-metrics.js";
import { EmbeddingPipeline } from "../../src/pipeline/embedding-pipeline.js";
import { EmbeddingRegistryBucket } from "../../src/registry/embedding-registry-bucket.js";
import { EmbeddingRegistry } from "../../src/registry/embedding-registry.js";
import { EmbeddingResolver } from "../../src/resolver/embedding-resolver.js";
import { EmbeddingValidator } from "../../src/validator/embedding-validator.js";
import { executionFixture } from "../helpers/execution-fixture.js";

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

function makePipeline() {
  const registry = new EmbeddingRegistry();
  const resolver = new EmbeddingResolver(registry);
  const metrics = new EmbeddingMetrics();
  const pipeline = new EmbeddingPipeline(new EmbeddingValidator(), metrics, registry, resolver);
  return { pipeline, registry, resolver, metrics };
}

describe("EmbeddingPipeline — extra scenarios", () => {
  it("audit entry actor is the Request's requestedBy", () => {
    const { pipeline, registry } = makePipeline();
    registerProviderAndModel(registry);
    const execution = executionFixture({
      request: { ...executionFixture().request, requestedBy: "alice" },
    });
    const result = pipeline.run({ execution, operation: "test" });
    expect(result.auditTrail[0]!.actor).toBe("alice");
  });

  it("each successive Pipeline run appends to (not replaces) history/logs/auditTrail", () => {
    const { pipeline, registry } = makePipeline();
    registerProviderAndModel(registry);
    let execution = executionFixture();
    execution = pipeline.run({ execution, operation: "op1" });
    execution = pipeline.run({ execution, operation: "op2" });
    expect(execution.logs).toHaveLength(2);
    expect(execution.auditTrail).toHaveLength(2);
  });

  it("running twice does not duplicate resolvedProvider/resolvedModel resolution errors", () => {
    const { pipeline, registry } = makePipeline();
    registerProviderAndModel(registry);
    let execution = executionFixture();
    execution = pipeline.run({ execution, operation: "op1" });
    execution = pipeline.run({ execution, operation: "op2" });
    expect(execution.resolvedProvider?.type).toBe(EmbeddingProviderType.OPENAI);
  });

  it("logging message references the operation and embeddingId", () => {
    const { pipeline, registry } = makePipeline();
    registerProviderAndModel(registry);
    const result = pipeline.run({ execution: executionFixture(), operation: "custom_op" });
    expect(result.logs[0]!.message).toContain("custom_op");
    expect(result.logs[0]!.message).toContain(result.metadata.embeddingId);
  });

  it("without a reason, the audit entry's details field is undefined", () => {
    const { pipeline, registry } = makePipeline();
    registerProviderAndModel(registry);
    const result = pipeline.run({ execution: executionFixture(), operation: "test" });
    expect(result.auditTrail[0]!.details).toBeUndefined();
  });
});
