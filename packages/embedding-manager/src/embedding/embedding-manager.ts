import type { IPublisher } from "@aos/event-bus";

import type { EmbeddingManagerConfig } from "../config/embedding-manager-config.js";
import { createEmbeddingContext } from "../context/create-embedding-context.js";
import type {
  CreateEmbeddingInput,
  CreateEmbeddingJobInput,
  CreateEmbeddingJobResult,
  EmbeddingJobTokenInput,
  EmbeddingSessionTokenInput,
  EmbeddingTokenInput,
  FailEmbeddingInput,
  FailEmbeddingJobInput,
  ListEmbeddingsResult,
  OpenEmbeddingSessionInput,
} from "../contracts/i-embedding-manager-operations.js";
import type { EmbeddingExecution } from "../domain/embedding-execution.js";
import type { EmbeddingModelName } from "../domain/embedding-model-name.js";
import type { EmbeddingProviderType } from "../domain/embedding-provider-type.js";
import { EmbeddingRecord } from "../domain/embedding-record.js";
import {
  buildModelRegistryId,
  buildProviderRegistryId,
} from "../domain/embedding-registry-keys.js";
import { EmbeddingSessionState } from "../domain/embedding-session-state.js";
import type { EmbeddingSessionRecord } from "../domain/embedding-session.js";
import { EmbeddingState } from "../domain/embedding-state.js";
import { EmbeddingNotFoundException } from "../errors/embedding-not-found-exception.js";
import { EmbeddingEvents } from "../events/embedding-events.js";
import { EmbeddingManagerEventType } from "../events/embedding-manager-event-type.js";
import { EmbeddingFactory } from "../factory/embedding-factory.js";
import { EmbeddingHealth } from "../health/embedding-health.js";
import { EmbeddingLifecycle } from "../lifecycle/embedding-lifecycle.js";
import { EmbeddingManagerLedger } from "../manager/embedding-manager-ledger.js";
import { EmbeddingMetrics } from "../metrics/embedding-metrics.js";
import {
  EmbeddingMiddleware,
  type EmbeddingMiddlewareFn,
} from "../middleware/embedding-middleware.js";
import { EmbeddingMonitoring } from "../monitoring/embedding-monitoring.js";
import { EmbeddingPipeline } from "../pipeline/embedding-pipeline.js";
import { EmbeddingRegistryBucket } from "../registry/embedding-registry-bucket.js";
import type { EmbeddingRegistryEntry } from "../registry/embedding-registry-entry.js";
import { EmbeddingRegistry } from "../registry/embedding-registry.js";
import { EmbeddingResolver } from "../resolver/embedding-resolver.js";
import { EmbeddingSession } from "../session/embedding-session.js";
import { EmbeddingStateMachine } from "../state-machine/embedding-state-machine.js";
import type { EmbeddingStatistics } from "../statistics/embedding-statistics.js";
import { generateEmbeddingManagerToken } from "../token/embedding-manager-token.js";
import { generateId } from "../utils/id.js";
import { EmbeddingValidator } from "../validator/embedding-validator.js";

/**
 * "EmbeddingManager" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Public API") — the
 * primary API façade for the package. Wires the internal `EmbeddingManagerLedger`
 * (Registry + Session + Statistics + token-keyed ledger) + StateMachine + Pipeline +
 * Middleware + Resolver + Validator + Events. Implements every Embedding Operation as a
 * metadata/lifecycle method: drive the State Machine to the target state via one atomic
 * 10-stage Pipeline call -> record relevant domain metadata -> update statistics ->
 * publish the matching event(s) -> return the updated `EmbeddingRecord`. This package
 * NEVER generates embeddings itself — `start()` is the ONLY method that may invoke a
 * caller-registered `IEmbeddingProvider`, and even then only records the
 * `EmbeddingResultMetadata` it returns, never a vector.
 */
export class EmbeddingManager {
  readonly registry: EmbeddingRegistry;
  readonly ledger: EmbeddingManagerLedger;
  readonly stateMachine: EmbeddingStateMachine;
  readonly validator: EmbeddingValidator;
  readonly pipeline: EmbeddingPipeline;
  readonly middleware: EmbeddingMiddleware;
  readonly resolver: EmbeddingResolver;
  readonly events: EmbeddingEvents;
  readonly metrics: EmbeddingMetrics;
  readonly health: EmbeddingHealth;
  readonly monitoring: EmbeddingMonitoring;
  readonly statistics: EmbeddingStatistics;
  readonly lifecycle: EmbeddingLifecycle;
  readonly factory: EmbeddingFactory;
  readonly session: EmbeddingSession;

  constructor(
    publisher: IPublisher,
    private readonly config: EmbeddingManagerConfig = {},
  ) {
    this.registry = new EmbeddingRegistry();
    this.session = new EmbeddingSession();
    this.ledger = new EmbeddingManagerLedger(this.registry, this.session);
    this.stateMachine = new EmbeddingStateMachine();
    this.metrics = new EmbeddingMetrics();
    this.validator = new EmbeddingValidator();
    this.resolver = new EmbeddingResolver(this.registry);
    this.pipeline = new EmbeddingPipeline(
      this.validator,
      this.metrics,
      this.registry,
      this.resolver,
    );
    this.middleware = new EmbeddingMiddleware();
    this.events = new EmbeddingEvents(publisher);
    this.health = new EmbeddingHealth(this.registry);
    this.monitoring = new EmbeddingMonitoring(this.metrics, this.registry);
    /* Share the Ledger's Statistics instance rather than creating a second, unsynced one. */
    this.statistics = this.ledger.statistics;
    this.lifecycle = new EmbeddingLifecycle();
    this.factory = new EmbeddingFactory();
  }

  /** Registers an `embedding.use(...)` Koa-style middleware onto the shared chain. */
  use(middleware: EmbeddingMiddlewareFn): this {
    this.middleware.use(middleware);
    return this;
  }

  /** Whether a caller supplied an `IEmbeddingProvider` via config — the only seam `start()` uses. */
  hasProvider(): boolean {
    return this.config.provider !== undefined;
  }

  /* ---- Setup helpers (required plumbing before a Request can reference a Provider/Model/Version/Namespace/Configuration) ---- */

  /**
   * Registers an `EmbeddingProvider` and publishes `ProviderRegistered`. This is setup
   * plumbing, NOT part of the state-machine-driven Embedding Operations flow — matching
   * the "setup plumbing outside the main operation count" pattern documented in
   * `@aos/knowledge-marketplace`'s (005.7J) report.
   */
  async registerProvider(input: {
    readonly providerId?: string;
    readonly name: string;
    readonly type: EmbeddingProviderType;
    readonly tenantId: string;
    readonly active?: boolean;
  }) {
    const providerId = input.providerId ?? buildProviderRegistryId(input.tenantId, input.type);
    const provider = this.factory.provider.create({ ...input, providerId });
    this.registry.register(EmbeddingRegistryBucket.PROVIDER, provider);
    this.metrics.recordProviderRegistered();
    await this.events.publishEmbeddingEvent(
      EmbeddingManagerEventType.PROVIDER_REGISTERED,
      createEmbeddingContext({ embeddingId: providerId, tenantId: input.tenantId }),
      { providerId: provider.providerId, type: provider.type },
    );
    return provider;
  }

  /** Registers an `EmbeddingModel` and publishes `ModelRegistered`. Setup plumbing, not a state-machine operation. */
  async registerModel(input: {
    readonly modelId?: string;
    readonly name: EmbeddingModelName;
    readonly providerType: EmbeddingProviderType;
    readonly tenantId: string;
    readonly dimensions?: number;
    readonly active?: boolean;
  }) {
    const modelId = input.modelId ?? buildModelRegistryId(input.tenantId, input.name);
    const model = this.factory.model.create({ ...input, modelId });
    this.registry.register(EmbeddingRegistryBucket.MODEL, model);
    this.metrics.recordModelRegistered();
    await this.events.publishEmbeddingEvent(
      EmbeddingManagerEventType.MODEL_REGISTERED,
      createEmbeddingContext({ embeddingId: modelId, tenantId: input.tenantId }),
      { modelId: model.modelId, name: model.name },
    );
    return model;
  }

  /** Registers an `EmbeddingVersion` and publishes `VersionCreated`. Setup plumbing, not a state-machine operation. */
  async registerVersion(input: {
    readonly versionId?: string;
    readonly modelId: string;
    readonly providerType: EmbeddingProviderType;
    readonly tenantId: string;
    readonly versionLabel: string;
    readonly compatibilityNotes?: string;
  }) {
    const versionId = input.versionId ?? `${input.modelId}::${input.versionLabel}`;
    const version = this.factory.version.create({ ...input, versionId });
    this.registry.register(EmbeddingRegistryBucket.VERSION, version);
    this.metrics.recordVersionCreated();
    await this.events.publishEmbeddingEvent(
      EmbeddingManagerEventType.VERSION_CREATED,
      createEmbeddingContext({ embeddingId: versionId, tenantId: input.tenantId }),
      { versionId: version.versionId, versionLabel: version.versionLabel },
    );
    return version;
  }

  registerNamespace(input: {
    readonly namespaceId: string;
    readonly name: string;
    readonly tenantId: string;
    readonly active?: boolean;
  }) {
    const now = new Date().toISOString();
    const namespace = {
      id: input.namespaceId,
      namespaceId: input.namespaceId,
      name: input.name,
      tenantId: input.tenantId,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.registry.register(EmbeddingRegistryBucket.NAMESPACE, namespace);
    this.metrics.recordNamespaceRegistered();
    return namespace;
  }

  registerConfiguration(input: {
    readonly configurationId: string;
    readonly embeddingId: string;
    readonly tenantId: string;
    readonly timeoutMs?: number;
    readonly retries?: number;
    readonly batchSize?: number;
    readonly custom?: Readonly<Record<string, unknown>>;
  }) {
    const configuration = this.factory.configuration.create(input);
    this.resolver.registerConfiguration(configuration);
    return configuration;
  }

  /* ---- Embedding Operations ---- */

  async createEmbedding(input: CreateEmbeddingInput): Promise<EmbeddingRecord> {
    const token = generateEmbeddingManagerToken();
    const embeddingId = generateId();
    const context = { ...input.context, token, embeddingId };

    const embedding = this.factory.embedding.create({
      token,
      embeddingId,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
    });

    const metadata = this.factory.metadata.create({
      embeddingId,
      title: input.title,
      description: input.description,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      tags: input.tags,
      createdBy: input.requestedBy,
    });

    const request = {
      id: generateId(),
      requestId: generateId(),
      embeddingId,
      tenantId: context.tenantId,
      textReference: input.textReference,
      contentReference: input.contentReference,
      providerType: input.providerType,
      modelName: input.modelName,
      namespaceId: input.namespaceId,
      configurationId: input.configurationId,
      requestedBy: input.requestedBy,
      instructions: input.instructions,
      createdAt: new Date().toISOString(),
    };

    const draft: EmbeddingExecution = {
      instance: embedding,
      context,
      metadata,
      request,
      resultMetadata: [],
      history: [],
      auditTrail: [],
      logs: [],
    };

    const pipelined = this.pipeline.run({
      execution: draft,
      operation: "create_embedding",
      targetState: EmbeddingState.DRAFT,
    });
    await this.middleware.run(pipelined);

    const entry: EmbeddingRegistryEntry = {
      id: pipelined.metadata.embeddingId,
      token,
      metadata: pipelined.metadata,
    };
    this.ledger.register(token, pipelined, entry);

    await this.events.publishEmbeddingEvent(EmbeddingManagerEventType.EMBEDDING_CREATED, context);

    return new EmbeddingRecord(pipelined);
  }

  async queue(input: EmbeddingTokenInput): Promise<EmbeddingRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "queue_embedding",
      EmbeddingState.QUEUED,
      input.reason,
    );
    await this.events.publishEmbeddingEvent(
      EmbeddingManagerEventType.EMBEDDING_QUEUED,
      execution.context,
    );
    return new EmbeddingRecord(pipelined);
  }

  /** Drives the Embedding to Preparing, running Provider/Model/Namespace/Configuration Resolution via the Pipeline. */
  async prepare(input: EmbeddingTokenInput): Promise<EmbeddingRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "prepare_embedding",
      EmbeddingState.PREPARING,
      input.reason,
    );
    return new EmbeddingRecord(pipelined);
  }

  /**
   * Drives the Embedding to Embedding and, ONLY if a caller registered an
   * `IEmbeddingProvider` via config, invokes it and records the returned
   * `EmbeddingResultMetadata`. The provider is optional — this package never generates
   * embeddings itself and ships no default implementation.
   */
  async start(input: EmbeddingTokenInput): Promise<EmbeddingRecord> {
    const execution = this.requireExecution(input.token);
    let pipelined = await this.runPipeline(
      execution,
      "start_embedding",
      EmbeddingState.EMBEDDING,
      input.reason,
    );

    await this.events.publishEmbeddingEvent(
      EmbeddingManagerEventType.EMBEDDING_STARTED,
      execution.context,
    );

    if (this.config.provider) {
      const providerResult = await this.config.provider.embed(pipelined.request);
      const resultId = generateId();
      const resultMetadata = {
        id: resultId,
        resultId,
        embeddingId: pipelined.metadata.embeddingId,
        tenantId: pipelined.context.tenantId,
        dimensionCount: providerResult.dimensionCount,
        providerReportedMetadata: providerResult.providerReportedMetadata,
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      pipelined = { ...pipelined, resultMetadata: [...pipelined.resultMetadata, resultMetadata] };
      this.ledger.update(input.token, pipelined);
    }

    return new EmbeddingRecord(pipelined);
  }

  async complete(input: EmbeddingTokenInput): Promise<EmbeddingRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "complete_embedding",
      EmbeddingState.COMPLETED,
      input.reason,
    );
    this.statistics.recordCompleted(pipelined.request.providerType);
    await this.events.publishEmbeddingEvent(
      EmbeddingManagerEventType.EMBEDDING_COMPLETED,
      execution.context,
    );
    return new EmbeddingRecord(pipelined);
  }

  async fail(input: FailEmbeddingInput): Promise<EmbeddingRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "fail_embedding",
      EmbeddingState.FAILED,
      input.reason,
    );
    this.statistics.recordFailed(pipelined.request.providerType);
    await this.events.publishEmbeddingEvent(
      EmbeddingManagerEventType.EMBEDDING_FAILED,
      execution.context,
    );
    return new EmbeddingRecord(pipelined);
  }

  async cancel(input: EmbeddingTokenInput): Promise<EmbeddingRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "cancel_embedding",
      EmbeddingState.CANCELLED,
      input.reason,
    );
    this.statistics.recordCancelled(pipelined.request.providerType);
    await this.events.publishEmbeddingEvent(
      EmbeddingManagerEventType.EMBEDDING_CANCELLED,
      execution.context,
    );
    return new EmbeddingRecord(pipelined);
  }

  async archive(input: EmbeddingTokenInput): Promise<EmbeddingRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "archive_embedding",
      EmbeddingState.ARCHIVED,
      input.reason,
    );
    await this.events.publishEmbeddingEvent(
      EmbeddingManagerEventType.EMBEDDING_ARCHIVED,
      execution.context,
    );
    return new EmbeddingRecord(pipelined);
  }

  async destroy(input: EmbeddingTokenInput): Promise<EmbeddingRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "destroy_embedding",
      EmbeddingState.DESTROYED,
      input.reason,
    );
    await this.events.publishEmbeddingEvent(
      EmbeddingManagerEventType.EMBEDDING_DESTROYED,
      execution.context,
    );
    return new EmbeddingRecord(pipelined);
  }

  /* ---- Session Operations ---- */

  openSession(input: OpenEmbeddingSessionInput): EmbeddingSessionRecord {
    const execution = this.requireExecution(input.token);
    this.session.open(input.token, input.holder, input.ttlMs);
    const now = new Date();
    const domainSession: EmbeddingSessionRecord = {
      id: input.token,
      sessionId: generateId(),
      embeddingId: execution.metadata.embeddingId,
      tenantId: execution.context.tenantId,
      holder: input.holder,
      state: EmbeddingSessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: input.ttlMs ? new Date(now.getTime() + input.ttlMs).toISOString() : undefined,
    };
    this.registry.register(EmbeddingRegistryBucket.SESSION, domainSession);
    return domainSession;
  }

  closeSession(input: EmbeddingSessionTokenInput): EmbeddingSessionRecord {
    this.session.close(input.token);
    return this.transitionSession(input.token, EmbeddingSessionState.CLOSED);
  }

  cancelSession(input: EmbeddingSessionTokenInput): EmbeddingSessionRecord {
    this.session.cancel(input.token);
    return this.transitionSession(input.token, EmbeddingSessionState.CANCELLED);
  }

  expireSession(input: EmbeddingSessionTokenInput): EmbeddingSessionRecord {
    this.session.expire(input.token);
    return this.transitionSession(input.token, EmbeddingSessionState.EXPIRED);
  }

  renewSession(input: EmbeddingSessionTokenInput): EmbeddingSessionRecord {
    const ledger = this.session.renew(input.token, input.ttlMs);
    const existing = this.registry.require<EmbeddingSessionRecord>(
      EmbeddingRegistryBucket.SESSION,
      input.token,
    );
    const updated: EmbeddingSessionRecord = { ...existing, expiresAt: ledger.expiresAt };
    this.registry.replace(EmbeddingRegistryBucket.SESSION, updated);
    return updated;
  }

  /* ---- Job Operations ---- */

  createJob(input: CreateEmbeddingJobInput): CreateEmbeddingJobResult {
    const jobId = generateId();
    const job = {
      id: jobId,
      jobId,
      embeddingId: input.embeddingId,
      tenantId: input.tenantId,
      priority: input.priority ?? 5,
      scheduledAt: input.scheduledAt,
      createdAt: new Date().toISOString(),
    };
    this.ledger.registerJob(job);
    return { job };
  }

  completeJob(input: EmbeddingJobTokenInput) {
    const job = this.ledger.requireJob(input.jobId);
    return this.ledger.updateJob({ ...job, completedAt: new Date().toISOString() });
  }

  failJob(input: FailEmbeddingJobInput) {
    const job = this.ledger.requireJob(input.jobId);
    return this.ledger.updateJob({
      ...job,
      failedAt: new Date().toISOString(),
      failureReason: input.reason,
    });
  }

  /* ---- Read Operations ---- */

  get(token: string): EmbeddingRecord | undefined {
    const execution = this.ledger.get(token);
    return execution ? new EmbeddingRecord(execution) : undefined;
  }

  require(token: string): EmbeddingRecord {
    return new EmbeddingRecord(this.requireExecution(token));
  }

  list(): ListEmbeddingsResult {
    return { embeddings: this.ledger.list().map((execution) => new EmbeddingRecord(execution)) };
  }

  count(): number {
    return this.ledger.count();
  }

  /* ---- Private helpers ---- */

  /** Runs the 10-stage Pipeline, the Middleware chain, and persists the result via the Ledger. */
  private async runPipeline(
    execution: EmbeddingExecution,
    operation: string,
    targetState?: EmbeddingState,
    reason?: string,
  ): Promise<EmbeddingExecution> {
    const result = this.pipeline.run({ execution, operation, targetState, reason });
    await this.middleware.run(result);
    this.ledger.update(execution.instance.token, result);
    this.registry.replace(EmbeddingRegistryBucket.EMBEDDING, {
      id: result.metadata.embeddingId,
      token: result.instance.token,
      metadata: result.metadata,
    });
    return result;
  }

  private requireExecution(token: string): EmbeddingExecution {
    const execution = this.ledger.get(token);
    if (!execution) {
      throw new EmbeddingNotFoundException(`No Embedding is registered for Token "${token}"`);
    }
    return execution;
  }

  private transitionSession(token: string, state: EmbeddingSessionState): EmbeddingSessionRecord {
    const existing = this.registry.require<EmbeddingSessionRecord>(
      EmbeddingRegistryBucket.SESSION,
      token,
    );
    const updated: EmbeddingSessionRecord = {
      ...existing,
      state,
      closedAt: new Date().toISOString(),
    };
    this.registry.replace(EmbeddingRegistryBucket.SESSION, updated);
    return updated;
  }
}
