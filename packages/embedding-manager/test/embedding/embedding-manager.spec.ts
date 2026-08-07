import { describe, expect, it, vi } from "vitest";

import { EmbeddingModelName } from "../../src/domain/embedding-model-name.js";
import { EmbeddingProviderType } from "../../src/domain/embedding-provider-type.js";
import { EmbeddingState } from "../../src/domain/embedding-state.js";
import { EmbeddingManagerEventType } from "../../src/events/embedding-manager-event-type.js";
import { contextFixture } from "../helpers/context-fixture.js";
import {
  createCompletedEmbedding,
  createDraftEmbedding,
  createEmbeddingInProgress,
  managerFixture,
  registerDefaultProviderAndModel,
} from "../helpers/manager-fixture.js";

describe("EmbeddingManager — Embedding Operations", () => {
  it("createEmbedding() creates a Draft Embedding and publishes EmbeddingCreated", async () => {
    const { manager, publish } = managerFixture();
    await registerDefaultProviderAndModel(manager);
    const record = await manager.createEmbedding({
      context: contextFixture({ embeddingId: "e-1" }),
      title: "Test",
      textReference: "ref-1",
      providerType: EmbeddingProviderType.OPENAI,
      modelName: EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
      requestedBy: "user-1",
    });
    expect(record.state).toBe(EmbeddingState.DRAFT);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: EmbeddingManagerEventType.EMBEDDING_CREATED }),
    );
  });

  it("queue() drives Draft -> Queued and publishes EmbeddingQueued", async () => {
    const { manager, publish } = managerFixture();
    const token = await createDraftEmbedding(manager);
    const record = await manager.queue({ token });
    expect(record.state).toBe(EmbeddingState.QUEUED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: EmbeddingManagerEventType.EMBEDDING_QUEUED }),
    );
  });

  it("prepare() drives Queued -> Preparing and resolves Provider/Model", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    await manager.queue({ token });
    const record = await manager.prepare({ token });
    expect(record.state).toBe(EmbeddingState.PREPARING);
    expect(record.resolvedProvider).toBeDefined();
    expect(record.resolvedModel).toBeDefined();
  });

  it("start() drives Preparing -> Embedding and publishes EmbeddingStarted", async () => {
    const { manager, publish } = managerFixture();
    const token = await createDraftEmbedding(manager);
    await manager.queue({ token });
    await manager.prepare({ token });
    const record = await manager.start({ token });
    expect(record.state).toBe(EmbeddingState.EMBEDDING);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: EmbeddingManagerEventType.EMBEDDING_STARTED }),
    );
  });

  it("start() invokes a caller-registered IEmbeddingProvider and records EmbeddingResultMetadata", async () => {
    const embed = vi.fn(async () => ({
      dimensionCount: 1536,
      providerReportedMetadata: { latencyMs: 12 },
    }));
    const { manager } = managerFixture({ provider: { embed } });
    const token = await createDraftEmbedding(manager);
    await manager.queue({ token });
    await manager.prepare({ token });
    const record = await manager.start({ token });
    expect(embed).toHaveBeenCalledTimes(1);
    expect(record.resultMetadata).toHaveLength(1);
    expect(record.resultMetadata[0]!.dimensionCount).toBe(1536);
  });

  it("start() does NOT invoke a provider when none is configured", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    await manager.queue({ token });
    await manager.prepare({ token });
    const record = await manager.start({ token });
    expect(record.resultMetadata).toHaveLength(0);
  });

  it("hasProvider() reflects whether a provider was configured", () => {
    const withProvider = managerFixture({ provider: { embed: vi.fn() } });
    const withoutProvider = managerFixture();
    expect(withProvider.manager.hasProvider()).toBe(true);
    expect(withoutProvider.manager.hasProvider()).toBe(false);
  });

  it("complete() drives Embedding -> Completed, records statistics, publishes EmbeddingCompleted", async () => {
    const { manager, publish } = managerFixture();
    const token = await createEmbeddingInProgress(manager);
    const record = await manager.complete({ token });
    expect(record.state).toBe(EmbeddingState.COMPLETED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: EmbeddingManagerEventType.EMBEDDING_COMPLETED }),
    );
    expect(manager.statistics.get(EmbeddingProviderType.OPENAI).completedCount).toBe(1);
  });

  it("fail() drives Embedding -> Failed with a reason, publishes EmbeddingFailed", async () => {
    const { manager, publish } = managerFixture();
    const token = await createEmbeddingInProgress(manager);
    const record = await manager.fail({ token, reason: "provider timeout" });
    expect(record.state).toBe(EmbeddingState.FAILED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: EmbeddingManagerEventType.EMBEDDING_FAILED }),
    );
    expect(manager.statistics.get(EmbeddingProviderType.OPENAI).failedCount).toBe(1);
  });

  it("cancel() drives any non-terminal state to Cancelled, publishes EmbeddingCancelled", async () => {
    const { manager, publish } = managerFixture();
    const token = await createDraftEmbedding(manager);
    const record = await manager.cancel({ token });
    expect(record.state).toBe(EmbeddingState.CANCELLED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: EmbeddingManagerEventType.EMBEDDING_CANCELLED }),
    );
    expect(manager.statistics.get(EmbeddingProviderType.OPENAI).cancelledCount).toBe(1);
  });

  it("archive() drives a settled Embedding to Archived, publishes EmbeddingArchived", async () => {
    const { manager, publish } = managerFixture();
    const token = await createCompletedEmbedding(manager);
    const record = await manager.archive({ token });
    expect(record.state).toBe(EmbeddingState.ARCHIVED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: EmbeddingManagerEventType.EMBEDDING_ARCHIVED }),
    );
  });

  it("destroy() drives any state to the terminal Destroyed, publishes EmbeddingDestroyed", async () => {
    const { manager, publish } = managerFixture();
    const token = await createDraftEmbedding(manager);
    const record = await manager.destroy({ token });
    expect(record.state).toBe(EmbeddingState.DESTROYED);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: EmbeddingManagerEventType.EMBEDDING_DESTROYED }),
    );
  });

  it("operations throw EmbeddingNotFoundException for an unknown token", async () => {
    const { manager } = managerFixture();
    await expect(manager.queue({ token: "missing" })).rejects.toThrow();
  });

  it("use() registers embedding.use(...) Koa-style middleware and it runs during operations", async () => {
    const { manager } = managerFixture();
    const seen: string[] = [];
    manager.use(async (execution, next) => {
      seen.push(execution.instance.state);
      await next();
    });
    await createDraftEmbedding(manager);
    expect(seen.length).toBeGreaterThan(0);
  });
});

describe("EmbeddingManager — Session Operations", () => {
  it("openSession() opens a session and registers it in the SESSION bucket", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    const session = manager.openSession({ token, holder: "user-1" });
    expect(session.holder).toBe("user-1");
    expect(session.state).toBe("open");
  });

  it("closeSession() transitions to CLOSED", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    manager.openSession({ token, holder: "user-1" });
    const session = manager.closeSession({ token });
    expect(session.state).toBe("closed");
  });

  it("cancelSession() transitions to CANCELLED", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    manager.openSession({ token, holder: "user-1" });
    const session = manager.cancelSession({ token });
    expect(session.state).toBe("cancelled");
  });

  it("expireSession() transitions to EXPIRED", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    manager.openSession({ token, holder: "user-1" });
    const session = manager.expireSession({ token });
    expect(session.state).toBe("expired");
  });

  it("renewSession() extends expiresAt", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    const opened = manager.openSession({ token, holder: "user-1", ttlMs: 1000 });
    const renewed = manager.renewSession({ token, ttlMs: 60_000 });
    expect(Date.parse(renewed.expiresAt!)).toBeGreaterThan(Date.parse(opened.expiresAt!));
  });
});

describe("EmbeddingManager — Job Operations", () => {
  it("createJob() registers a Job for an Embedding", () => {
    const { manager } = managerFixture();
    const { job } = manager.createJob({ embeddingId: "e-1", tenantId: "tenant-1" });
    expect(job.embeddingId).toBe("e-1");
    expect(job.priority).toBe(5);
  });

  it("completeJob() stamps completedAt", () => {
    const { manager } = managerFixture();
    const { job } = manager.createJob({ embeddingId: "e-1", tenantId: "tenant-1" });
    const completed = manager.completeJob({ jobId: job.jobId });
    expect(completed.completedAt).toBeDefined();
  });

  it("failJob() stamps failedAt/failureReason", () => {
    const { manager } = managerFixture();
    const { job } = manager.createJob({ embeddingId: "e-1", tenantId: "tenant-1" });
    const failed = manager.failJob({ jobId: job.jobId, reason: "boom" });
    expect(failed.failureReason).toBe("boom");
  });
});

describe("EmbeddingManager — Provider Operations", () => {
  it("registerProvider() registers a Provider and publishes ProviderRegistered", async () => {
    const { manager, publish } = managerFixture();
    const provider = await manager.registerProvider({
      name: "OpenAI",
      type: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
    });
    expect(provider.type).toBe(EmbeddingProviderType.OPENAI);
    expect(manager.metrics.snapshot().providerCount).toBe(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: EmbeddingManagerEventType.PROVIDER_REGISTERED }),
    );
  });

  it("registerProvider() defaults the id to the deterministic composite key", async () => {
    const { manager } = managerFixture();
    const provider = await manager.registerProvider({
      name: "OpenAI",
      type: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
    });
    expect(provider.providerId).toBe("tenant-1::openai");
  });

  it("registerProvider() honors an explicit providerId", async () => {
    const { manager } = managerFixture();
    const provider = await manager.registerProvider({
      providerId: "custom-id",
      name: "OpenAI",
      type: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
    });
    expect(provider.providerId).toBe("custom-id");
  });
});

describe("EmbeddingManager — Model Operations", () => {
  it("registerModel() registers a Model and publishes ModelRegistered", async () => {
    const { manager, publish } = managerFixture();
    const model = await manager.registerModel({
      name: EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
      providerType: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
    });
    expect(model.name).toBe(EmbeddingModelName.TEXT_EMBEDDING_3_SMALL);
    expect(manager.metrics.snapshot().modelCount).toBe(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: EmbeddingManagerEventType.MODEL_REGISTERED }),
    );
  });

  it("registerModel() defaults the id to the deterministic composite key", async () => {
    const { manager } = managerFixture();
    const model = await manager.registerModel({
      name: EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
      providerType: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
    });
    expect(model.modelId).toBe("tenant-1::text-embedding-3-small");
  });
});

describe("EmbeddingManager — Version Operations", () => {
  it("registerVersion() registers a Version and publishes VersionCreated", async () => {
    const { manager, publish } = managerFixture();
    const version = await manager.registerVersion({
      modelId: "m-1",
      providerType: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
      versionLabel: "1.0.0",
    });
    expect(version.versionLabel).toBe("1.0.0");
    expect(manager.metrics.snapshot().versionCount).toBe(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: EmbeddingManagerEventType.VERSION_CREATED }),
    );
  });

  it("registerVersion() defaults id to modelId::versionLabel", async () => {
    const { manager } = managerFixture();
    const version = await manager.registerVersion({
      modelId: "m-1",
      providerType: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
      versionLabel: "1.0.0",
    });
    expect(version.versionId).toBe("m-1::1.0.0");
  });

  it("registered Version resolves via EmbeddingResolver", async () => {
    const { manager } = managerFixture();
    const version = await manager.registerVersion({
      modelId: "m-1",
      providerType: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
      versionLabel: "1.0.0",
    });
    expect(manager.resolver.resolveVersion(version.versionId)).toEqual(version);
  });
});

describe("EmbeddingManager — Namespace Operations", () => {
  it("registerNamespace() registers a Namespace", () => {
    const { manager } = managerFixture();
    const namespace = manager.registerNamespace({
      namespaceId: "ns-1",
      name: "docs",
      tenantId: "tenant-1",
    });
    expect(namespace.name).toBe("docs");
    expect(manager.metrics.snapshot().namespaceCount).toBe(1);
  });

  it("createEmbedding() with a registered Namespace resolves it during prepare()", async () => {
    const { manager } = managerFixture();
    manager.registerNamespace({ namespaceId: "ns-1", name: "docs", tenantId: "tenant-1" });
    const token = await createDraftEmbedding(manager, { namespaceId: "ns-1" });
    await manager.queue({ token });
    const record = await manager.prepare({ token });
    expect(record.resolvedNamespace?.namespaceId).toBe("ns-1");
  });
});

describe("EmbeddingManager — Configuration Operations", () => {
  it("registerConfiguration() registers a Configuration on the resolver", () => {
    const { manager } = managerFixture();
    const configuration = manager.registerConfiguration({
      configurationId: "cfg-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      timeoutMs: 5000,
    });
    expect(configuration.timeoutMs).toBe(5000);
    expect(manager.resolver.resolveConfiguration("cfg-1")).toEqual(configuration);
  });

  it("createEmbedding() with a registered Configuration resolves it during prepare()", async () => {
    const { manager } = managerFixture();
    manager.registerConfiguration({
      configurationId: "cfg-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
    });
    const token = await createDraftEmbedding(manager, { configurationId: "cfg-1" });
    await manager.queue({ token });
    const record = await manager.prepare({ token });
    expect(record.configuration?.configurationId).toBe("cfg-1");
  });
});

describe("EmbeddingManager — Provider Resolution", () => {
  it("createEmbedding() throws when the declared Provider is not registered (Provider Resolution runs on every Pipeline call, not only prepare())", async () => {
    const { manager } = managerFixture();
    /* CUSTOM_PROVIDER + CUSTOM is a compatible pair per the catalog, so this is not a
     * Validator pre-flight failure — but no EmbeddingProvider record is ever
     * registered, so Pipeline Stage 2 (Provider Resolution) must fail. Built manually
     * (not via createDraftEmbedding, which auto-registers a matching Provider/Model). */
    await expect(
      manager.createEmbedding({
        context: contextFixture({ embeddingId: "e-unregistered" }),
        title: "Test",
        textReference: "ref-1",
        providerType: EmbeddingProviderType.CUSTOM_PROVIDER,
        modelName: EmbeddingModelName.CUSTOM,
        requestedBy: "user-1",
      }),
    ).rejects.toThrow();
  });

  it("prepare() resolves the Provider purely by tenant-scoped Provider Type (no scan)", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    await manager.queue({ token });
    const record = await manager.prepare({ token });
    expect(record.resolvedProvider?.type).toBe(EmbeddingProviderType.OPENAI);
  });

  it("prepare() never invokes the configured IEmbeddingProvider (resolution only)", async () => {
    const embed = vi.fn();
    const { manager } = managerFixture({ provider: { embed } });
    const token = await createDraftEmbedding(manager);
    await manager.queue({ token });
    await manager.prepare({ token });
    expect(embed).not.toHaveBeenCalled();
  });
});

describe("EmbeddingManager — Read Operations", () => {
  it("get() returns undefined for an unknown token", () => {
    const { manager } = managerFixture();
    expect(manager.get("missing")).toBeUndefined();
  });

  it("get() returns the record for a known token", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    expect(manager.get(token)?.token).toBe(token);
  });

  it("require() throws for an unknown token", () => {
    const { manager } = managerFixture();
    expect(() => manager.require("missing")).toThrow();
  });

  it("list() returns all created Embeddings", async () => {
    const { manager } = managerFixture();
    await createDraftEmbedding(manager);
    await createDraftEmbedding(manager);
    expect(manager.list().embeddings).toHaveLength(2);
  });

  it("count() reflects the number of created Embeddings", async () => {
    const { manager } = managerFixture();
    await createDraftEmbedding(manager);
    expect(manager.count()).toBe(1);
  });
});

describe("EmbeddingManager — full lifecycle flow", () => {
  it("drives Draft -> Queued -> Preparing -> Embedding -> Completed -> Archived", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    await manager.queue({ token });
    await manager.prepare({ token });
    await manager.start({ token });
    await manager.complete({ token });
    const record = await manager.archive({ token });
    expect(record.state).toBe(EmbeddingState.ARCHIVED);
    expect(record.history.length).toBeGreaterThanOrEqual(5);
  });

  it("drives Draft -> Queued -> Preparing -> Embedding -> Failed -> Destroyed", async () => {
    const { manager } = managerFixture();
    const token = await createEmbeddingInProgress(manager);
    await manager.fail({ token, reason: "boom" });
    const record = await manager.destroy({ token });
    expect(record.state).toBe(EmbeddingState.DESTROYED);
  });
});
