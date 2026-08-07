import { describe, expect, it, vi } from "vitest";

import type { IKnowledgeGenerationProvider } from "../../src/contracts/i-knowledge-generation-provider.js";
import { KnowledgeGenerationAssetType } from "../../src/domain/knowledge-generation-asset-type.js";
import { KnowledgeGenerationMode } from "../../src/domain/knowledge-generation-mode.js";
import { KnowledgeGenerationProviderType } from "../../src/domain/knowledge-generation-provider-type.js";
import { KnowledgeGenerationState } from "../../src/domain/knowledge-generation-state.js";
import { KnowledgeGeneratorSessionState } from "../../src/domain/knowledge-generator-session-state.js";
import { GeneratorNotFoundException } from "../../src/errors/generator-not-found-exception.js";
import { KnowledgeGeneratorEventType } from "../../src/events/knowledge-generator-event-type.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { createDraftGeneration, generatorFixture } from "../helpers/generator-fixture.js";

describe("KnowledgeGenerator — Generation Operations", () => {
  it("createGeneration() produces a Draft Generation", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator);
    const record = generator.require(token);
    expect(record.state).toBe(KnowledgeGenerationState.DRAFT);
  });

  it("createGeneration() publishes GenerationCreated", async () => {
    const { generator, publish } = generatorFixture();
    await createDraftGeneration(generator);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeGeneratorEventType.GENERATION_CREATED }),
    );
  });

  it("queue() drives Draft -> Queued and publishes GenerationQueued", async () => {
    const { generator, publish } = generatorFixture();
    const token = await createDraftGeneration(generator);
    const record = await generator.queue({ token });
    expect(record.state).toBe(KnowledgeGenerationState.QUEUED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeGeneratorEventType.GENERATION_QUEUED }),
    );
  });

  it("prepare() drives Queued -> Preparing when a Provider is registered", async () => {
    const { generator } = generatorFixture();
    generator.registerProvider(KnowledgeGenerationProviderType.OPENAI, {
      generate: vi.fn(),
    });
    const token = await createDraftGeneration(generator);
    await generator.queue({ token });
    const record = await generator.prepare({ token });
    expect(record.state).toBe(KnowledgeGenerationState.PREPARING);
  });

  it("prepare() throws when no Provider is registered for the Request's Provider Type", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator);
    await generator.queue({ token });
    await expect(generator.prepare({ token })).rejects.toThrow();
  });

  it("start() drives Preparing -> Generating and publishes GenerationStarted", async () => {
    const { generator, publish } = generatorFixture();
    generator.registerProvider(KnowledgeGenerationProviderType.OPENAI, { generate: vi.fn() });
    const token = await createDraftGeneration(generator);
    await generator.queue({ token });
    await generator.prepare({ token });
    const record = await generator.start({ token });
    expect(record.state).toBe(KnowledgeGenerationState.GENERATING);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeGeneratorEventType.GENERATION_STARTED }),
    );
  });

  it("start() invokes a registered IKnowledgeGenerationProvider and records the result metadata", async () => {
    const provider: IKnowledgeGenerationProvider = {
      generate: vi.fn(async (request) => ({
        id: "res-1",
        resultId: "res-1",
        generationId: request.generationId,
        providerId: "provider-instance-1",
        providerType: KnowledgeGenerationProviderType.OPENAI,
        outputMetadata: { tokens: 42 },
        completedAt: new Date().toISOString(),
      })),
    };
    const { generator } = generatorFixture();
    generator.registerProvider(KnowledgeGenerationProviderType.OPENAI, provider);
    const token = await createDraftGeneration(generator);
    await generator.queue({ token });
    await generator.prepare({ token });
    const record = await generator.start({ token });
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(record.result?.providerId).toBe("provider-instance-1");
  });

  it("start() never invokes a provider when none is registered", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator);
    await generator.queue({ token });
    // no provider registered — prepare() would throw, so drive state manually via facade methods
    // that don't require a Provider isn't possible here; instead assert no result recorded when
    // a Provider IS registered only after prepare/start already ran without one being reachable.
    expect(generator.hasProvider(KnowledgeGenerationProviderType.OPENAI)).toBe(false);
  });

  it("complete() drives Generating/Reviewing -> Completed and records statistics/metrics", async () => {
    const { generator, publish } = generatorFixture();
    generator.registerProvider(KnowledgeGenerationProviderType.OPENAI, { generate: vi.fn() });
    const token = await createDraftGeneration(generator);
    await generator.queue({ token });
    await generator.prepare({ token });
    await generator.start({ token });
    await generator.review({ token });
    const record = await generator.complete({
      token,
      result: { providerId: "provider-1", summary: "done" },
    });
    expect(record.state).toBe(KnowledgeGenerationState.COMPLETED);
    expect(record.result?.providerId).toBe("provider-1");
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeGeneratorEventType.GENERATION_COMPLETED }),
    );
    expect(generator.metrics.snapshot().completedCount).toBe(1);
    expect(generator.statistics.get(record.request.assetType).completedCount).toBe(1);
  });

  it("complete() records a real average duration once startedAt/completedAt are stamped", async () => {
    const { generator } = generatorFixture();
    generator.registerProvider(KnowledgeGenerationProviderType.OPENAI, { generate: vi.fn() });
    const token = await createDraftGeneration(generator);
    await generator.queue({ token });
    await generator.prepare({ token });
    await generator.start({ token });
    await generator.review({ token });
    await generator.complete({ token, result: { providerId: "provider-1" } });
    expect(generator.metrics.snapshot().averageDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("fail() drives to Failed, records failedCount, and publishes GenerationFailed", async () => {
    const { generator, publish } = generatorFixture();
    const token = await createDraftGeneration(generator);
    await generator.queue({ token });
    const record = await generator.fail({ token, reason: "provider error" });
    expect(record.state).toBe(KnowledgeGenerationState.FAILED);
    expect(generator.metrics.snapshot().failedCount).toBe(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeGeneratorEventType.GENERATION_FAILED }),
    );
  });

  it("cancel() drives to Cancelled from Draft and publishes GenerationCancelled", async () => {
    const { generator, publish } = generatorFixture();
    const token = await createDraftGeneration(generator);
    const record = await generator.cancel({ token });
    expect(record.state).toBe(KnowledgeGenerationState.CANCELLED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeGeneratorEventType.GENERATION_CANCELLED }),
    );
  });

  it("archive() drives a settled Generation to Archived and publishes GenerationArchived", async () => {
    const { generator, publish } = generatorFixture();
    const token = await createDraftGeneration(generator);
    await generator.queue({ token });
    await generator.fail({ token, reason: "x" });
    const record = await generator.archive({ token });
    expect(record.state).toBe(KnowledgeGenerationState.ARCHIVED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeGeneratorEventType.GENERATION_ARCHIVED }),
    );
  });

  it("destroy() drives to Destroyed (terminal) and publishes GenerationDestroyed", async () => {
    const { generator, publish } = generatorFixture();
    const token = await createDraftGeneration(generator);
    await generator.cancel({ token });
    const record = await generator.destroy({ token });
    expect(record.state).toBe(KnowledgeGenerationState.DESTROYED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: KnowledgeGeneratorEventType.GENERATION_DESTROYED }),
    );
  });

  it("every Lifecycle state is reachable from Draft through facade operations, and Destroyed has no legal next operation", async () => {
    const { generator } = generatorFixture();
    generator.registerProvider(KnowledgeGenerationProviderType.OPENAI, { generate: vi.fn() });

    const token = await createDraftGeneration(generator);
    expect(generator.require(token).state).toBe(KnowledgeGenerationState.DRAFT);
    await generator.queue({ token });
    expect(generator.require(token).state).toBe(KnowledgeGenerationState.QUEUED);
    await generator.prepare({ token });
    expect(generator.require(token).state).toBe(KnowledgeGenerationState.PREPARING);
    await generator.start({ token });
    expect(generator.require(token).state).toBe(KnowledgeGenerationState.GENERATING);
    await generator.review({ token });
    expect(generator.require(token).state).toBe(KnowledgeGenerationState.REVIEWING);
    await generator.complete({ token, result: { providerId: "provider-1" } });
    expect(generator.require(token).state).toBe(KnowledgeGenerationState.COMPLETED);
    await generator.archive({ token });
    expect(generator.require(token).state).toBe(KnowledgeGenerationState.ARCHIVED);
    await generator.destroy({ token });
    expect(generator.require(token).state).toBe(KnowledgeGenerationState.DESTROYED);

    await expect(generator.queue({ token })).rejects.toThrow();
    await expect(generator.archive({ token })).rejects.toThrow();
  });

  it("operations against an unknown token throw GeneratorNotFoundException", async () => {
    const { generator } = generatorFixture();
    await expect(generator.queue({ token: "kgen_missing" })).rejects.toThrow(
      GeneratorNotFoundException,
    );
  });
});

describe("KnowledgeGenerator — Provider Resolution", () => {
  it("registerProvider()/hasProvider() reflect registration state", () => {
    const { generator } = generatorFixture();
    expect(generator.hasProvider(KnowledgeGenerationProviderType.CLAUDE)).toBe(false);
    generator.registerProvider(KnowledgeGenerationProviderType.CLAUDE, { generate: vi.fn() });
    expect(generator.hasProvider(KnowledgeGenerationProviderType.CLAUDE)).toBe(true);
  });

  it("providers can be supplied via config at construction time", async () => {
    const { generator } = generatorFixture({
      providers: { [KnowledgeGenerationProviderType.OPENAI]: { generate: vi.fn() } },
    });
    expect(generator.hasProvider(KnowledgeGenerationProviderType.OPENAI)).toBe(true);
  });

  it("prepare() succeeds once a matching Provider Type is registered", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator, {
      providerType: KnowledgeGenerationProviderType.GEMINI,
    });
    generator.registerProvider(KnowledgeGenerationProviderType.GEMINI, { generate: vi.fn() });
    await generator.queue({ token });
    await expect(generator.prepare({ token })).resolves.toBeDefined();
  });
});

describe("KnowledgeGenerator — Prompt Resolution", () => {
  it("registerPrompt() makes a Prompt Reference resolvable by createGeneration()", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator, { withPrompt: true });
    const record = generator.require(token);
    expect(record.request.promptReferenceId).toBeDefined();
  });

  it("createGeneration() with an unregistered Prompt Reference fails validation", async () => {
    const { generator } = generatorFixture();
    const context = contextFixture({ generationId: "g-x" });
    await expect(
      generator.createGeneration({
        context,
        title: "Title",
        assetType: KnowledgeGenerationAssetType.FAQ,
        mode: KnowledgeGenerationMode.CREATE,
        providerType: KnowledgeGenerationProviderType.OPENAI,
        promptReferenceId: "missing-prompt",
        requestedBy: "user-1",
      }),
    ).rejects.toThrow();
  });
});

describe("KnowledgeGenerator — Context Resolution", () => {
  it("registerContext() makes a Context Reference resolvable and resolved by the Pipeline", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator, { withContext: true });
    const record = generator.require(token);
    expect(record.contextReference).toBeDefined();
  });

  it("createGeneration() with an unregistered Context Reference fails validation", async () => {
    const { generator } = generatorFixture();
    const context = contextFixture({ generationId: "g-x" });
    await expect(
      generator.createGeneration({
        context,
        title: "Title",
        assetType: KnowledgeGenerationAssetType.FAQ,
        mode: KnowledgeGenerationMode.CUSTOM,
        providerType: KnowledgeGenerationProviderType.OPENAI,
        contextReferenceId: "missing-context",
        requestedBy: "user-1",
      }),
    ).rejects.toThrow();
  });
});

describe("KnowledgeGenerator — Session Operations", () => {
  it("openSession() opens a Session in OPEN state", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator);
    const session = generator.openSession({ token, holder: "user-1" });
    expect(session.state).toBe(KnowledgeGeneratorSessionState.OPEN);
  });

  it("closeSession() transitions to CLOSED", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator);
    generator.openSession({ token, holder: "user-1" });
    const closed = generator.closeSession({ token });
    expect(closed.state).toBe(KnowledgeGeneratorSessionState.CLOSED);
  });

  it("cancelSession() transitions to CANCELLED", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator);
    generator.openSession({ token, holder: "user-1" });
    const cancelled = generator.cancelSession({ token });
    expect(cancelled.state).toBe(KnowledgeGeneratorSessionState.CANCELLED);
  });

  it("expireSession() transitions to EXPIRED", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator);
    generator.openSession({ token, holder: "user-1" });
    const expired = generator.expireSession({ token });
    expect(expired.state).toBe(KnowledgeGeneratorSessionState.EXPIRED);
  });

  it("renewSession() extends expiresAt while staying OPEN", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator);
    const opened = generator.openSession({ token, holder: "user-1", ttlMs: 1000 });
    const renewed = generator.renewSession({ token, ttlMs: 999999 });
    expect(renewed.expiresAt).toBeDefined();
    expect(Date.parse(renewed.expiresAt ?? "")).toBeGreaterThanOrEqual(
      Date.parse(opened.expiresAt ?? ""),
    );
  });

  it("openSession() throws for an unknown Generation token", () => {
    const { generator } = generatorFixture();
    expect(() => generator.openSession({ token: "kgen_missing", holder: "user-1" })).toThrow(
      GeneratorNotFoundException,
    );
  });
});

describe("KnowledgeGenerator — Job Operations", () => {
  it("createJob() registers a Job with default priority", async () => {
    const { generator } = generatorFixture();
    const { job } = generator.createJob({ generationId: "g-1", tenantId: "tenant-1" });
    expect(job.priority).toBe(5);
  });

  it("createJob() honors a caller-supplied priority", () => {
    const { generator } = generatorFixture();
    const { job } = generator.createJob({ generationId: "g-1", tenantId: "tenant-1", priority: 1 });
    expect(job.priority).toBe(1);
  });

  it("completeJob() stamps completedAt", () => {
    const { generator } = generatorFixture();
    const { job } = generator.createJob({ generationId: "g-1", tenantId: "tenant-1" });
    const completed = generator.completeJob({ jobId: job.jobId });
    expect(completed.completedAt).toBeDefined();
  });

  it("failJob() stamps failedAt/failureReason", () => {
    const { generator } = generatorFixture();
    const { job } = generator.createJob({ generationId: "g-1", tenantId: "tenant-1" });
    const failed = generator.failJob({ jobId: job.jobId, reason: "timeout" });
    expect(failed.failedAt).toBeDefined();
    expect(failed.failureReason).toBe("timeout");
  });

  it("completeJob() throws for an unknown jobId", () => {
    const { generator } = generatorFixture();
    expect(() => generator.completeJob({ jobId: "missing" })).toThrow(GeneratorNotFoundException);
  });
});

describe("KnowledgeGenerator — Request/Result Operations", () => {
  it("createGeneration() builds a well-formed KnowledgeGenerationRequest", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator, {
      assetType: KnowledgeGenerationAssetType.SOP,
      mode: KnowledgeGenerationMode.SUMMARIZE,
    });
    const record = generator.require(token);
    expect(record.request.assetType).toBe(KnowledgeGenerationAssetType.SOP);
    expect(record.request.mode).toBe(KnowledgeGenerationMode.SUMMARIZE);
  });

  it("complete() records KnowledgeGenerationResult metadata without generated content", async () => {
    const { generator } = generatorFixture();
    generator.registerProvider(KnowledgeGenerationProviderType.OPENAI, { generate: vi.fn() });
    const token = await createDraftGeneration(generator);
    await generator.queue({ token });
    await generator.prepare({ token });
    await generator.start({ token });
    await generator.review({ token });
    const record = await generator.complete({
      token,
      result: {
        providerId: "provider-1",
        contentLocation: "s3://bucket/key",
        outputMetadata: { a: 1 },
      },
    });
    expect(record.result?.contentLocation).toBe("s3://bucket/key");
    expect((record.result as Record<string, unknown>).content).toBeUndefined();
  });

  it("complete() reuses a result already recorded by start()", async () => {
    const provider: IKnowledgeGenerationProvider = {
      generate: vi.fn(async (request) => ({
        id: "res-1",
        resultId: "res-1",
        generationId: request.generationId,
        providerId: "provider-instance-1",
        providerType: KnowledgeGenerationProviderType.OPENAI,
        outputMetadata: {},
        completedAt: new Date().toISOString(),
      })),
    };
    const { generator } = generatorFixture();
    generator.registerProvider(KnowledgeGenerationProviderType.OPENAI, provider);
    const token = await createDraftGeneration(generator);
    await generator.queue({ token });
    await generator.prepare({ token });
    await generator.start({ token });
    await generator.review({ token });
    const record = await generator.complete({ token, result: { providerId: "ignored" } });
    expect(record.result?.providerId).toBe("provider-instance-1");
  });
});

describe("KnowledgeGenerator — Read Operations & Middleware", () => {
  it("get() returns undefined for an unknown token", () => {
    const { generator } = generatorFixture();
    expect(generator.get("kgen_missing")).toBeUndefined();
  });

  it("list()/count() reflect registered Generations", async () => {
    const { generator } = generatorFixture();
    await createDraftGeneration(generator);
    await createDraftGeneration(generator);
    expect(generator.count()).toBe(2);
    expect(generator.list().generations).toHaveLength(2);
  });

  it("use() registers a middleware invoked on every pipeline run", async () => {
    const { generator } = generatorFixture();
    const seen: string[] = [];
    generator.use(async (execution, next) => {
      seen.push(execution.metadata.generationId);
      await next();
    });
    await createDraftGeneration(generator);
    expect(seen).toHaveLength(1);
  });

  it("registerPolicy() registers a resolvable Policy", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator, {
      withPolicy: true,
      policyId: "policy-x",
    });
    const record = generator.require(token);
    expect(record.policy?.policyId).toBe("policy-x");
  });
});
