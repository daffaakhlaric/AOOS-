import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeGenerationAssetType } from "../../src/domain/knowledge-generation-asset-type.js";
import { KnowledgeGenerationMode } from "../../src/domain/knowledge-generation-mode.js";
import { KnowledgeGenerationProviderType } from "../../src/domain/knowledge-generation-provider-type.js";
import { KnowledgeGenerationState } from "../../src/domain/knowledge-generation-state.js";
import type { KnowledgeGeneratorExecution } from "../../src/domain/knowledge-generator-execution.js";
import { GenerationContextException } from "../../src/errors/generation-context-exception.js";
import { GenerationPolicyException } from "../../src/errors/generation-policy-exception.js";
import { GenerationPromptException } from "../../src/errors/generation-prompt-exception.js";
import { GenerationProviderException } from "../../src/errors/generation-provider-exception.js";
import { GenerationValidationException } from "../../src/errors/generation-validation-exception.js";
import { KnowledgeGeneratorMetrics } from "../../src/metrics/knowledge-generator-metrics.js";
import { KnowledgeGeneratorPipeline } from "../../src/pipeline/knowledge-generator-pipeline.js";
import { KnowledgeGeneratorRegistryBucket } from "../../src/registry/knowledge-generator-registry-bucket.js";
import { KnowledgeGeneratorRegistry } from "../../src/registry/knowledge-generator-registry.js";
import { KnowledgeGeneratorResolver } from "../../src/resolver/knowledge-generator-resolver.js";
import { KnowledgeGeneratorValidator } from "../../src/validator/knowledge-generator-validator.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = new Date().toISOString();

function buildExecution(
  overrides: Partial<KnowledgeGeneratorExecution["request"]> = {},
): KnowledgeGeneratorExecution {
  return {
    instance: {
      id: "g-1",
      token: "kgen_pipe",
      generationId: "g-1",
      tenantId: "tenant-1",
      state: KnowledgeGenerationState.DRAFT,
      createdAt: now,
      updatedAt: now,
    },
    context: contextFixture({ generationId: "g-1" }),
    metadata: {
      generationId: "g-1",
      title: "Title",
      tenantId: "tenant-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    request: {
      id: "r-1",
      requestId: "r-1",
      generationId: "g-1",
      assetType: KnowledgeGenerationAssetType.FAQ,
      mode: KnowledgeGenerationMode.CUSTOM,
      providerType: KnowledgeGenerationProviderType.OPENAI,
      requestedBy: "user-1",
      createdAt: now,
      ...overrides,
    },
    history: [],
    auditTrail: [],
    logs: [],
  };
}

/** Always-valid stub used to isolate Pipeline stages 2-5's OWN resolution/exception logic
 * from the 12-stage Validator's overlapping pre-flight checks (the Validator normally
 * catches an unresolvable reference before the Pipeline stage that would otherwise
 * resolve it ever runs — this stub lets these tests exercise that stage in isolation). */
const permissiveValidator = {
  stageNames: [] as readonly string[],
  validate: () => ({ valid: true, issues: [] }),
} as unknown as KnowledgeGeneratorValidator;

describe("KnowledgeGeneratorPipeline", () => {
  let registry: KnowledgeGeneratorRegistry;
  let resolver: KnowledgeGeneratorResolver;
  let metrics: KnowledgeGeneratorMetrics;
  let pipeline: KnowledgeGeneratorPipeline;
  let permissivePipeline: KnowledgeGeneratorPipeline;
  let providerAvailable: boolean;

  beforeEach(() => {
    registry = new KnowledgeGeneratorRegistry();
    resolver = new KnowledgeGeneratorResolver(registry);
    metrics = new KnowledgeGeneratorMetrics();
    providerAvailable = true;
    pipeline = new KnowledgeGeneratorPipeline(
      new KnowledgeGeneratorValidator(),
      metrics,
      registry,
      resolver,
      () => providerAvailable,
    );
    permissivePipeline = new KnowledgeGeneratorPipeline(
      permissiveValidator,
      metrics,
      registry,
      resolver,
      () => providerAvailable,
    );
  });

  it("runs all 10 stages for a minimal valid Request (Custom mode, no references)", () => {
    const result = pipeline.run({ execution: buildExecution(), operation: "create_generation" });
    expect(result.auditTrail).toHaveLength(1);
    expect(result.logs).toHaveLength(1);
    expect(metrics.snapshot().generationCount).toBe(1);
  });

  it("Stage 1 — throws GenerationValidationException on invalid input", () => {
    const execution = buildExecution({ requestedBy: "" });
    expect(() => pipeline.run({ execution, operation: "create_generation" })).toThrow(
      GenerationValidationException,
    );
  });

  it("Stage 1 — records validation metrics on success and failure", () => {
    pipeline.run({ execution: buildExecution(), operation: "create_generation" });
    expect(metrics.snapshot().validationCount).toBe(1);
    expect(metrics.snapshot().validationFailureCount).toBe(0);
    try {
      pipeline.run({
        execution: buildExecution({ requestedBy: "" }),
        operation: "create_generation",
      });
    } catch {
      /* expected */
    }
    expect(metrics.snapshot().validationFailureCount).toBe(1);
  });

  it("Stage 2 — resolves and attaches a declared Context Reference", () => {
    registry.register(KnowledgeGeneratorRegistryBucket.CONTEXT, {
      id: "context-1",
      contextId: "context-1",
      tenantId: "tenant-1",
      referenceData: {},
      createdAt: now,
    });
    const execution = buildExecution({ contextReferenceId: "context-1" });
    const result = pipeline.run({ execution, operation: "create_generation" });
    expect(result.contextReference?.contextId).toBe("context-1");
    expect(metrics.snapshot().contextUsageCount).toBe(1);
  });

  it("Stage 2 — throws GenerationContextException for an unregistered Context Reference", () => {
    const execution = buildExecution({ contextReferenceId: "missing" });
    expect(() => permissivePipeline.run({ execution, operation: "create_generation" })).toThrow(
      GenerationContextException,
    );
  });

  it("Stage 3 — resolves and attaches a declared Prompt Reference", () => {
    registry.register(KnowledgeGeneratorRegistryBucket.PROMPT, {
      id: "prompt-1",
      promptId: "prompt-1",
      promptVersion: "1.0.0",
      namespace: "default",
      createdAt: now,
    });
    const execution = buildExecution({ promptReferenceId: "prompt-1" });
    const result = pipeline.run({ execution, operation: "create_generation" });
    expect(result.promptReference?.promptId).toBe("prompt-1");
    expect(metrics.snapshot().promptUsageCount).toBe(1);
  });

  it("Stage 3 — throws GenerationPromptException for an unregistered Prompt Reference", () => {
    const execution = buildExecution({ promptReferenceId: "missing" });
    expect(() => permissivePipeline.run({ execution, operation: "create_generation" })).toThrow(
      GenerationPromptException,
    );
  });

  it("Stage 3 — never constructs prompt text (promptReference has no text field)", () => {
    registry.register(KnowledgeGeneratorRegistryBucket.PROMPT, {
      id: "prompt-1",
      promptId: "prompt-1",
      promptVersion: "1.0.0",
      namespace: "default",
      createdAt: now,
    });
    const execution = buildExecution({ promptReferenceId: "prompt-1" });
    const result = pipeline.run({ execution, operation: "create_generation" });
    expect((result.promptReference as Record<string, unknown>).text).toBeUndefined();
  });

  it("Stage 4 — resolves and evaluates an allowing Policy", () => {
    registry.register(KnowledgeGeneratorRegistryBucket.POLICY, {
      id: "policy-1",
      policyId: "policy-1",
      name: "Policy",
      tenantId: "tenant-1",
      allowedAssetTypes: [],
      allowedProviderTypes: [],
      allowedModes: [],
      requireApproval: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    const execution = buildExecution({ policyId: "policy-1" });
    const result = pipeline.run({ execution, operation: "create_generation" });
    expect(result.policy?.policyId).toBe("policy-1");
    expect(metrics.snapshot().policyUsageCount).toBe(1);
  });

  it("Stage 4 — throws GenerationPolicyException for a denying Policy", () => {
    registry.register(KnowledgeGeneratorRegistryBucket.POLICY, {
      id: "policy-1",
      policyId: "policy-1",
      name: "Policy",
      tenantId: "tenant-1",
      allowedAssetTypes: [KnowledgeGenerationAssetType.SOP],
      allowedProviderTypes: [],
      allowedModes: [],
      requireApproval: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    const execution = buildExecution({ policyId: "policy-1" });
    expect(() => permissivePipeline.run({ execution, operation: "create_generation" })).toThrow(
      GenerationPolicyException,
    );
  });

  it("Stage 5 — records provider usage when available, never invokes it", () => {
    const result = pipeline.run({ execution: buildExecution(), operation: "create_generation" });
    expect(metrics.snapshot().providerUsageCount).toBe(1);
    expect(result.result).toBeUndefined();
  });

  it("Stage 5 — does not throw when unavailable and requireProvider is false", () => {
    providerAvailable = false;
    expect(() =>
      pipeline.run({ execution: buildExecution(), operation: "create_generation" }),
    ).not.toThrow();
  });

  it("Stage 5 — throws GenerationProviderException when unavailable and requireProvider is true", () => {
    providerAvailable = false;
    expect(() =>
      permissivePipeline.run({
        execution: buildExecution(),
        operation: "prepare_generation",
        requireProvider: true,
      }),
    ).toThrow(GenerationProviderException);
  });

  it("Stage 6 — stamps metadata.updatedAt", () => {
    const before = buildExecution();
    const result = pipeline.run({ execution: before, operation: "create_generation" });
    expect(Date.parse(result.metadata.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(before.metadata.updatedAt),
    );
  });

  it("Stage 7 — records generation count", () => {
    pipeline.run({ execution: buildExecution(), operation: "create_generation" });
    pipeline.run({
      execution: {
        ...buildExecution(),
        instance: { ...buildExecution().instance, token: "kgen_2" },
      },
      operation: "create_generation",
    });
    expect(metrics.snapshot().generationCount).toBe(2);
  });

  it("Stage 8 — advances the State Machine when targetState differs", () => {
    const result = pipeline.run({
      execution: buildExecution(),
      operation: "queue_generation",
      targetState: KnowledgeGenerationState.QUEUED,
    });
    expect(result.instance.state).toBe(KnowledgeGenerationState.QUEUED);
    expect(result.history).toHaveLength(1);
  });

  it("Stage 8 — is a no-op when targetState equals the current state", () => {
    const result = pipeline.run({
      execution: buildExecution(),
      operation: "create_generation",
      targetState: KnowledgeGenerationState.DRAFT,
    });
    expect(result.history).toHaveLength(0);
  });

  it("Stage 9 — appends one Audit entry and registers it in the AUDIT bucket", () => {
    const result = pipeline.run({ execution: buildExecution(), operation: "create_generation" });
    expect(result.auditTrail).toHaveLength(1);
    expect(registry.count(KnowledgeGeneratorRegistryBucket.AUDIT)).toBe(1);
  });

  it("Stage 9 — audit entry records the actor from requestedBy", () => {
    const result = pipeline.run({ execution: buildExecution(), operation: "create_generation" });
    expect(result.auditTrail[0]?.actor).toBe("user-1");
  });

  it("Stage 10 — appends one structured log entry", () => {
    const result = pipeline.run({ execution: buildExecution(), operation: "create_generation" });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]?.level).toBe("info");
  });

  it("running the pipeline twice accumulates history/audit/logs", () => {
    let result = pipeline.run({ execution: buildExecution(), operation: "create_generation" });
    result = pipeline.run({
      execution: result,
      operation: "queue_generation",
      targetState: KnowledgeGenerationState.QUEUED,
    });
    expect(result.auditTrail).toHaveLength(2);
    expect(result.logs).toHaveLength(2);
    expect(result.history).toHaveLength(1);
  });
});
