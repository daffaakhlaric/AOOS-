import { describe, expect, it, vi } from "vitest";

import { KnowledgeGenerationProviderType } from "../../src/domain/knowledge-generation-provider-type.js";
import { KnowledgeGenerationState } from "../../src/domain/knowledge-generation-state.js";
import { GeneratorNotFoundException } from "../../src/errors/generator-not-found-exception.js";
import { createDraftGeneration, generatorFixture } from "../helpers/generator-fixture.js";

describe("KnowledgeGenerator — additional facade edge cases", () => {
  it("registerPrompt() returns the created Prompt Reference", () => {
    const { generator } = generatorFixture();
    const prompt = generator.registerPrompt({
      promptId: "p-extra",
      promptVersion: "2.0.0",
      namespace: "ns",
    });
    expect(prompt.promptId).toBe("p-extra");
  });

  it("registerContext() defaults referenceData to an empty object", () => {
    const { generator } = generatorFixture();
    const context = generator.registerContext({ contextId: "c-extra", tenantId: "tenant-1" });
    expect(context.referenceData).toEqual({});
  });

  it("registerPolicy() defaults requireApproval/active", () => {
    const { generator } = generatorFixture();
    const policy = generator.registerPolicy({
      policyId: "pol-extra",
      name: "Extra",
      tenantId: "tenant-1",
    });
    expect(policy.requireApproval).toBe(false);
    expect(policy.active).toBe(true);
  });

  it("require() throws GeneratorNotFoundException with a descriptive message", async () => {
    const { generator } = generatorFixture();
    expect(() => generator.require("kgen_missing")).toThrow(/No Generation is registered/);
    expect(() => generator.require("kgen_missing")).toThrow(GeneratorNotFoundException);
  });

  it("fail() without a Provider registered still succeeds (no Provider Resolution requirement)", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator);
    await generator.queue({ token });
    const record = await generator.fail({ token, reason: "manual failure" });
    expect(record.state).toBe(KnowledgeGenerationState.FAILED);
  });

  it("cancel() accepts an optional reason", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator);
    const record = await generator.cancel({ token, reason: "user requested" });
    expect(record.state).toBe(KnowledgeGenerationState.CANCELLED);
  });

  it("start() records provider usage metrics even when a provider IS registered", async () => {
    const { generator } = generatorFixture();
    generator.registerProvider(KnowledgeGenerationProviderType.OPENAI, { generate: vi.fn() });
    const token = await createDraftGeneration(generator);
    await generator.queue({ token });
    await generator.prepare({ token });
    await generator.start({ token });
    expect(generator.metrics.snapshot().providerUsageCount).toBeGreaterThanOrEqual(2);
  });

  it("multiple Generations get independent tokens", async () => {
    const { generator } = generatorFixture();
    const tokenA = await createDraftGeneration(generator);
    const tokenB = await createDraftGeneration(generator);
    expect(tokenA).not.toBe(tokenB);
  });

  it("destroy() is idempotent — a second destroy() call is a lifecycle no-op that stays Destroyed", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator);
    await generator.cancel({ token });
    await generator.destroy({ token });
    const record = await generator.destroy({ token });
    expect(record.state).toBe(KnowledgeGenerationState.DESTROYED);
    expect(generator.require(token).state).toBe(KnowledgeGenerationState.DESTROYED);
  });

  it("queue() on an already-Destroyed Generation throws (Destroyed has no legal outgoing edges to Queued)", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator);
    await generator.cancel({ token });
    await generator.destroy({ token });
    await expect(generator.queue({ token })).rejects.toThrow();
  });

  it("createJob() without a scheduledAt omits it", () => {
    const { generator } = generatorFixture();
    const { job } = generator.createJob({ generationId: "g-1", tenantId: "tenant-1" });
    expect(job.scheduledAt).toBeUndefined();
  });

  it("createJob() with a scheduledAt records it", () => {
    const { generator } = generatorFixture();
    const scheduledAt = new Date().toISOString();
    const { job } = generator.createJob({ generationId: "g-1", tenantId: "tenant-1", scheduledAt });
    expect(job.scheduledAt).toBe(scheduledAt);
  });

  it("failJob() throws GeneratorNotFoundException for an unknown jobId", () => {
    const { generator } = generatorFixture();
    expect(() => generator.failJob({ jobId: "missing", reason: "x" })).toThrow(
      GeneratorNotFoundException,
    );
  });

  it("openSession()/closeSession() round trip preserves the holder", async () => {
    const { generator } = generatorFixture();
    const token = await createDraftGeneration(generator);
    const opened = generator.openSession({ token, holder: "reviewer-1" });
    const closed = generator.closeSession({ token });
    expect(opened.holder).toBe("reviewer-1");
    expect(closed.holder).toBe("reviewer-1");
  });

  it("count() and list() start at zero on a fresh KnowledgeGenerator", () => {
    const { generator } = generatorFixture();
    expect(generator.count()).toBe(0);
    expect(generator.list().generations).toEqual([]);
  });

  it("health.check() and monitoring.sample() are usable directly off the façade", async () => {
    const { generator } = generatorFixture();
    await createDraftGeneration(generator);
    expect(generator.health.check().status).toBeDefined();
    expect(generator.monitoring.sample().metrics.generationCount).toBeGreaterThan(0);
  });

  it("lifecycle.states() exposed on the façade matches the domain state list", () => {
    const { generator } = generatorFixture();
    expect(generator.lifecycle.states()).toHaveLength(10);
  });
});
