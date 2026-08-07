import type { IPublisher } from "@aos/event-bus";

import type { KnowledgeGeneratorConfig } from "../config/knowledge-generator-config.js";
import type { IKnowledgeGenerationProvider } from "../contracts/i-knowledge-generation-provider.js";
import type {
  CompleteGenerationInput,
  CreateGenerationInput,
  CreateGenerationJobInput,
  CreateGenerationJobResult,
  FailGenerationInput,
  FailGenerationJobInput,
  GenerationJobTokenInput,
  GenerationTokenInput,
  GeneratorSessionTokenInput,
  ListGenerationsResult,
  OpenGeneratorSessionInput,
} from "../contracts/i-knowledge-generator-operations.js";
import type { KnowledgeGenerationAssetType } from "../domain/knowledge-generation-asset-type.js";
import type { KnowledgeGenerationJob } from "../domain/knowledge-generation-job.js";
import type { KnowledgeGenerationMode } from "../domain/knowledge-generation-mode.js";
import type { KnowledgeGenerationPolicy } from "../domain/knowledge-generation-policy.js";
import type { KnowledgeGenerationProviderType } from "../domain/knowledge-generation-provider-type.js";
import { KnowledgeGenerationRecord } from "../domain/knowledge-generation-record.js";
import type { KnowledgeGenerationSession } from "../domain/knowledge-generation-session.js";
import { KnowledgeGenerationState } from "../domain/knowledge-generation-state.js";
import type { KnowledgeGeneratorExecution } from "../domain/knowledge-generator-execution.js";
import { KnowledgeGeneratorSessionState } from "../domain/knowledge-generator-session-state.js";
import { GeneratorNotFoundException } from "../errors/generator-not-found-exception.js";
import { KnowledgeGeneratorEventType } from "../events/knowledge-generator-event-type.js";
import { KnowledgeGeneratorEvents } from "../events/knowledge-generator-events.js";
import { KnowledgeGeneratorFactory } from "../factory/knowledge-generator-factory.js";
import { KnowledgeGeneratorHealth } from "../health/knowledge-generator-health.js";
import { KnowledgeGeneratorLifecycle } from "../lifecycle/knowledge-generator-lifecycle.js";
import { KnowledgeGeneratorManager } from "../manager/knowledge-generator-manager.js";
import { KnowledgeGeneratorMetrics } from "../metrics/knowledge-generator-metrics.js";
import {
  KnowledgeGeneratorMiddleware,
  type GeneratorMiddleware,
} from "../middleware/knowledge-generator-middleware.js";
import { KnowledgeGeneratorMonitoring } from "../monitoring/knowledge-generator-monitoring.js";
import { KnowledgeGeneratorPipeline } from "../pipeline/knowledge-generator-pipeline.js";
import { KnowledgeGeneratorRegistryBucket } from "../registry/knowledge-generator-registry-bucket.js";
import type { KnowledgeGeneratorRegistryEntry } from "../registry/knowledge-generator-registry-entry.js";
import { KnowledgeGeneratorRegistry } from "../registry/knowledge-generator-registry.js";
import { KnowledgeGeneratorResolver } from "../resolver/knowledge-generator-resolver.js";
import { KnowledgeGeneratorSession } from "../session/knowledge-generator-session.js";
import { KnowledgeGeneratorStateMachine } from "../state-machine/knowledge-generator-state-machine.js";
import type { KnowledgeGeneratorStatistics } from "../statistics/knowledge-generator-statistics.js";
import { generateKnowledgeGeneratorToken } from "../token/knowledge-generator-token.js";
import { generateId } from "../utils/id.js";
import { KnowledgeGeneratorValidator } from "../validator/knowledge-generator-validator.js";

/**
 * "KnowledgeGenerator" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Public API") — the
 * primary API façade for the package, analogous in role to `KnowledgeMarketplace` in
 * `@aos/knowledge-marketplace`. Wires Manager + StateMachine + Pipeline + Middleware +
 * Resolver + Validator + Events. Implements every Generation Operation as a
 * metadata/lifecycle method: validate -> drive the State Machine to the target state
 * via one atomic 10-stage Pipeline call -> record relevant domain metadata -> update
 * statistics -> publish the matching event -> return the updated
 * `KnowledgeGenerationRecord`. This package NEVER generates content itself — `start()`
 * is the ONLY method that may invoke a caller-registered `IKnowledgeGenerationProvider`,
 * and only through the `generate()` interface method.
 */
export class KnowledgeGenerator {
  readonly registry: KnowledgeGeneratorRegistry;
  readonly manager: KnowledgeGeneratorManager;
  readonly stateMachine: KnowledgeGeneratorStateMachine;
  readonly validator: KnowledgeGeneratorValidator;
  readonly pipeline: KnowledgeGeneratorPipeline;
  readonly middleware: KnowledgeGeneratorMiddleware;
  readonly resolver: KnowledgeGeneratorResolver;
  readonly events: KnowledgeGeneratorEvents;
  readonly metrics: KnowledgeGeneratorMetrics;
  readonly health: KnowledgeGeneratorHealth;
  readonly monitoring: KnowledgeGeneratorMonitoring;
  readonly statistics: KnowledgeGeneratorStatistics;
  readonly lifecycle: KnowledgeGeneratorLifecycle;
  readonly factory: KnowledgeGeneratorFactory;
  readonly session: KnowledgeGeneratorSession;

  private readonly providersByType = new Map<
    KnowledgeGenerationProviderType,
    IKnowledgeGenerationProvider
  >();

  constructor(
    publisher: IPublisher,
    private readonly config: KnowledgeGeneratorConfig = {},
  ) {
    this.registry = new KnowledgeGeneratorRegistry();
    this.session = new KnowledgeGeneratorSession();
    this.manager = new KnowledgeGeneratorManager(this.registry, this.session);
    this.stateMachine = new KnowledgeGeneratorStateMachine();
    this.metrics = new KnowledgeGeneratorMetrics();
    this.validator = new KnowledgeGeneratorValidator();
    this.resolver = new KnowledgeGeneratorResolver(this.registry);
    for (const [type, provider] of Object.entries(config.providers ?? {})) {
      if (provider) {
        this.providersByType.set(type as KnowledgeGenerationProviderType, provider);
      }
    }
    this.pipeline = new KnowledgeGeneratorPipeline(
      this.validator,
      this.metrics,
      this.registry,
      this.resolver,
      (providerType) => this.providersByType.has(providerType as KnowledgeGenerationProviderType),
    );
    this.middleware = new KnowledgeGeneratorMiddleware();
    this.events = new KnowledgeGeneratorEvents(publisher);
    this.health = new KnowledgeGeneratorHealth(this.registry);
    this.monitoring = new KnowledgeGeneratorMonitoring(this.metrics, this.registry);
    /* Share the Manager's Statistics instance rather than creating a second, unsynced
     * one — matching the convention established by `KnowledgeMarketplace`. */
    this.statistics = this.manager.statistics;
    this.lifecycle = new KnowledgeGeneratorLifecycle();
    this.factory = new KnowledgeGeneratorFactory();
  }

  /** Registers a `generator.use(...)` Koa-style middleware onto the shared chain. */
  use(middleware: GeneratorMiddleware): this {
    this.middleware.use(middleware);
    return this;
  }

  /** Registers a caller-supplied `IKnowledgeGenerationProvider` under a `KnowledgeGenerationProviderType` — the only way Stage 5 (Provider Resolution) can ever find one. */
  registerProvider(
    providerType: KnowledgeGenerationProviderType,
    provider: IKnowledgeGenerationProvider,
  ): void {
    this.providersByType.set(providerType, provider);
  }

  hasProvider(providerType: KnowledgeGenerationProviderType): boolean {
    return this.providersByType.has(providerType);
  }

  /* ---- Setup helpers (required plumbing before a Request can reference a Prompt/Context/Policy) ---- */

  registerPrompt(input: {
    readonly promptId: string;
    readonly promptVersion: string;
    readonly namespace: string;
    readonly description?: string;
  }) {
    const prompt = this.factory.prompt.create(input);
    this.registry.register(KnowledgeGeneratorRegistryBucket.PROMPT, prompt);
    return prompt;
  }

  registerContext(input: {
    readonly contextId: string;
    readonly tenantId: string;
    readonly workspaceId?: string;
    readonly namespace?: string;
    readonly referenceData?: Readonly<Record<string, unknown>>;
  }) {
    const context = {
      id: input.contextId,
      contextId: input.contextId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      namespace: input.namespace,
      referenceData: { ...input.referenceData },
      createdAt: new Date().toISOString(),
    };
    this.registry.register(KnowledgeGeneratorRegistryBucket.CONTEXT, context);
    return context;
  }

  registerPolicy(input: {
    readonly policyId: string;
    readonly name: string;
    readonly tenantId: string;
    readonly allowedAssetTypes?: readonly KnowledgeGenerationAssetType[];
    readonly allowedProviderTypes?: readonly KnowledgeGenerationProviderType[];
    readonly allowedModes?: readonly KnowledgeGenerationMode[];
    readonly requireApproval?: boolean;
    readonly active?: boolean;
  }): KnowledgeGenerationPolicy {
    const now = new Date().toISOString();
    const policy: KnowledgeGenerationPolicy = {
      id: input.policyId,
      policyId: input.policyId,
      name: input.name,
      tenantId: input.tenantId,
      allowedAssetTypes: [...(input.allowedAssetTypes ?? [])],
      allowedProviderTypes: [...(input.allowedProviderTypes ?? [])],
      allowedModes: [...(input.allowedModes ?? [])],
      requireApproval: input.requireApproval ?? false,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.registry.register(KnowledgeGeneratorRegistryBucket.POLICY, policy);
    return policy;
  }

  /* ---- Generation Operations ---- */

  async createGeneration(input: CreateGenerationInput): Promise<KnowledgeGenerationRecord> {
    const token = generateKnowledgeGeneratorToken();
    const generationId = generateId();
    const context = { ...input.context, token, generationId };

    const generation = this.factory.generation.create({
      token,
      generationId,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
    });

    const metadata = this.factory.metadata.create({
      generationId,
      title: input.title,
      description: input.description,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      tags: input.tags,
      createdBy: input.requestedBy,
    });

    const request = this.factory.request.create({
      generationId,
      assetType: input.assetType,
      mode: input.mode,
      providerType: input.providerType,
      requestedBy: input.requestedBy,
      promptReferenceId: input.promptReferenceId,
      contextReferenceId: input.contextReferenceId,
      policyId: input.policyId,
      configurationId: input.configurationId,
      instructions: input.instructions,
    });

    const draft: KnowledgeGeneratorExecution = {
      instance: generation,
      context,
      metadata,
      request,
      history: [],
      auditTrail: [],
      logs: [],
    };

    const pipelined = this.pipeline.run({
      execution: draft,
      operation: "create_generation",
      targetState: KnowledgeGenerationState.DRAFT,
    });
    await this.middleware.run(pipelined);

    const entry: KnowledgeGeneratorRegistryEntry = {
      id: pipelined.metadata.generationId,
      token,
      metadata: pipelined.metadata,
    };
    this.manager.register(token, pipelined, entry);

    await this.events.publishGeneratorEvent(
      KnowledgeGeneratorEventType.GENERATION_CREATED,
      context,
    );

    return new KnowledgeGenerationRecord(pipelined);
  }

  async queue(input: GenerationTokenInput): Promise<KnowledgeGenerationRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "queue_generation",
      KnowledgeGenerationState.QUEUED,
      input.reason,
    );
    await this.events.publishGeneratorEvent(
      KnowledgeGeneratorEventType.GENERATION_QUEUED,
      execution.context,
    );
    return new KnowledgeGenerationRecord(pipelined);
  }

  async prepare(input: GenerationTokenInput): Promise<KnowledgeGenerationRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "prepare_generation",
      KnowledgeGenerationState.PREPARING,
      input.reason,
      true,
    );
    return new KnowledgeGenerationRecord(pipelined);
  }

  /** Drives the Generation to Generating and, ONLY if a caller registered an `IKnowledgeGenerationProvider` for this Request's Provider Type, invokes `provider.generate()` and records the returned `KnowledgeGenerationResult`. This package never generates content itself. */
  async start(input: GenerationTokenInput): Promise<KnowledgeGenerationRecord> {
    const execution = this.requireExecution(input.token);
    let pipelined = await this.runPipeline(
      execution,
      "start_generation",
      KnowledgeGenerationState.GENERATING,
      input.reason,
      true,
    );

    await this.events.publishGeneratorEvent(
      KnowledgeGeneratorEventType.GENERATION_STARTED,
      execution.context,
    );

    const provider = this.providersByType.get(pipelined.request.providerType);
    if (provider) {
      const result = await provider.generate(pipelined.request);
      pipelined = { ...pipelined, result };
      this.manager.update(input.token, pipelined);
    }

    return new KnowledgeGenerationRecord(pipelined);
  }

  /** Drives Generating -> Reviewing — the optional human/automated review checkpoint before `complete()`. */
  async review(input: GenerationTokenInput): Promise<KnowledgeGenerationRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "review_generation",
      KnowledgeGenerationState.REVIEWING,
      input.reason,
    );
    return new KnowledgeGenerationRecord(pipelined);
  }

  async complete(input: CompleteGenerationInput): Promise<KnowledgeGenerationRecord> {
    const execution = this.requireExecution(input.token);
    const result =
      execution.result ??
      this.factory.result.create({
        generationId: execution.metadata.generationId,
        providerId: input.result.providerId,
        providerType: execution.request.providerType,
        contentLocation: input.result.contentLocation,
        summary: input.result.summary,
        outputMetadata: input.result.outputMetadata,
      });

    const updated: KnowledgeGeneratorExecution = { ...execution, result };
    const pipelined = await this.runPipeline(
      updated,
      "complete_generation",
      KnowledgeGenerationState.COMPLETED,
      input.reason,
    );
    this.metrics.recordCompleted();
    this.statistics.recordCompleted(pipelined.request.assetType);
    if (pipelined.instance.startedAt) {
      const durationMs =
        Date.parse(pipelined.instance.completedAt ?? new Date().toISOString()) -
        Date.parse(pipelined.instance.startedAt);
      if (durationMs >= 0) {
        this.metrics.recordDuration(durationMs);
      }
    }

    await this.events.publishGeneratorEvent(
      KnowledgeGeneratorEventType.GENERATION_COMPLETED,
      execution.context,
    );
    return new KnowledgeGenerationRecord(pipelined);
  }

  async fail(input: FailGenerationInput): Promise<KnowledgeGenerationRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "fail_generation",
      KnowledgeGenerationState.FAILED,
      input.reason,
    );
    this.metrics.recordFailed();
    this.statistics.recordFailed(pipelined.request.assetType);

    await this.events.publishGeneratorEvent(
      KnowledgeGeneratorEventType.GENERATION_FAILED,
      execution.context,
      { reason: input.reason },
    );
    return new KnowledgeGenerationRecord(pipelined);
  }

  async cancel(input: GenerationTokenInput): Promise<KnowledgeGenerationRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "cancel_generation",
      KnowledgeGenerationState.CANCELLED,
      input.reason,
    );
    await this.events.publishGeneratorEvent(
      KnowledgeGeneratorEventType.GENERATION_CANCELLED,
      execution.context,
    );
    return new KnowledgeGenerationRecord(pipelined);
  }

  async archive(input: GenerationTokenInput): Promise<KnowledgeGenerationRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "archive_generation",
      KnowledgeGenerationState.ARCHIVED,
      input.reason,
    );
    await this.events.publishGeneratorEvent(
      KnowledgeGeneratorEventType.GENERATION_ARCHIVED,
      execution.context,
    );
    return new KnowledgeGenerationRecord(pipelined);
  }

  async destroy(input: GenerationTokenInput): Promise<KnowledgeGenerationRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "destroy_generation",
      KnowledgeGenerationState.DESTROYED,
      input.reason,
    );
    await this.events.publishGeneratorEvent(
      KnowledgeGeneratorEventType.GENERATION_DESTROYED,
      execution.context,
    );
    return new KnowledgeGenerationRecord(pipelined);
  }

  /* ---- Session Operations ---- */

  openSession(input: OpenGeneratorSessionInput): KnowledgeGenerationSession {
    const execution = this.requireExecution(input.token);
    this.session.open(input.token, input.holder, input.ttlMs);
    const domainSession: KnowledgeGenerationSession = {
      ...this.factory.session.create({
        generationId: execution.metadata.generationId,
        tenantId: execution.context.tenantId,
        holder: input.holder,
        ttlMs: input.ttlMs,
      }),
      id: input.token,
    };
    this.registry.register(KnowledgeGeneratorRegistryBucket.SESSION, domainSession);
    return domainSession;
  }

  closeSession(input: GeneratorSessionTokenInput): KnowledgeGenerationSession {
    this.session.close(input.token);
    return this.transitionSession(input.token, KnowledgeGeneratorSessionState.CLOSED);
  }

  cancelSession(input: GeneratorSessionTokenInput): KnowledgeGenerationSession {
    this.session.cancel(input.token);
    return this.transitionSession(input.token, KnowledgeGeneratorSessionState.CANCELLED);
  }

  expireSession(input: GeneratorSessionTokenInput): KnowledgeGenerationSession {
    this.session.expire(input.token);
    return this.transitionSession(input.token, KnowledgeGeneratorSessionState.EXPIRED);
  }

  renewSession(input: GeneratorSessionTokenInput): KnowledgeGenerationSession {
    const ledger = this.session.renew(input.token, input.ttlMs);
    const existing = this.registry.require<KnowledgeGenerationSession>(
      KnowledgeGeneratorRegistryBucket.SESSION,
      input.token,
    );
    const updated: KnowledgeGenerationSession = { ...existing, expiresAt: ledger.expiresAt };
    this.registry.replace(KnowledgeGeneratorRegistryBucket.SESSION, updated);
    return updated;
  }

  /* ---- Job Operations ---- */

  createJob(input: CreateGenerationJobInput): CreateGenerationJobResult {
    const jobId = generateId();
    const job: KnowledgeGenerationJob = {
      id: jobId,
      jobId,
      generationId: input.generationId,
      tenantId: input.tenantId,
      priority: input.priority ?? 5,
      scheduledAt: input.scheduledAt,
      createdAt: new Date().toISOString(),
    };
    this.registry.register(KnowledgeGeneratorRegistryBucket.JOB, job);
    return { job };
  }

  completeJob(input: GenerationJobTokenInput): KnowledgeGenerationJob {
    const job = this.registry.require<KnowledgeGenerationJob>(
      KnowledgeGeneratorRegistryBucket.JOB,
      input.jobId,
    );
    const updated: KnowledgeGenerationJob = { ...job, completedAt: new Date().toISOString() };
    this.registry.replace(KnowledgeGeneratorRegistryBucket.JOB, updated);
    return updated;
  }

  failJob(input: FailGenerationJobInput): KnowledgeGenerationJob {
    const job = this.registry.require<KnowledgeGenerationJob>(
      KnowledgeGeneratorRegistryBucket.JOB,
      input.jobId,
    );
    const updated: KnowledgeGenerationJob = {
      ...job,
      failedAt: new Date().toISOString(),
      failureReason: input.reason,
    };
    this.registry.replace(KnowledgeGeneratorRegistryBucket.JOB, updated);
    return updated;
  }

  /* ---- Read Operations ---- */

  get(token: string): KnowledgeGenerationRecord | undefined {
    const execution = this.manager.get(token);
    return execution ? new KnowledgeGenerationRecord(execution) : undefined;
  }

  require(token: string): KnowledgeGenerationRecord {
    return new KnowledgeGenerationRecord(this.requireExecution(token));
  }

  list(): ListGenerationsResult {
    return {
      generations: this.manager.list().map((execution) => new KnowledgeGenerationRecord(execution)),
    };
  }

  count(): number {
    return this.manager.count();
  }

  /* ---- Private helpers ---- */

  /** Runs the 10-stage Pipeline, the Middleware chain, and persists the result via the Manager. */
  private async runPipeline(
    execution: KnowledgeGeneratorExecution,
    operation: string,
    targetState?: KnowledgeGenerationState,
    reason?: string,
    requireProvider = false,
  ): Promise<KnowledgeGeneratorExecution> {
    const result = this.pipeline.run({
      execution,
      operation,
      targetState,
      reason,
      requireProvider,
    });
    await this.middleware.run(result);
    this.manager.update(execution.instance.token, result);
    this.registry.replace(KnowledgeGeneratorRegistryBucket.GENERATION, {
      id: result.metadata.generationId,
      token: result.instance.token,
      metadata: result.metadata,
    });
    return result;
  }

  private requireExecution(token: string): KnowledgeGeneratorExecution {
    const execution = this.manager.get(token);
    if (!execution) {
      throw new GeneratorNotFoundException(`No Generation is registered for Token "${token}"`);
    }
    return execution;
  }

  private transitionSession(
    token: string,
    state: KnowledgeGeneratorSessionState,
  ): KnowledgeGenerationSession {
    const existing = this.registry.require<KnowledgeGenerationSession>(
      KnowledgeGeneratorRegistryBucket.SESSION,
      token,
    );
    const updated: KnowledgeGenerationSession = {
      ...existing,
      state,
      closedAt: new Date().toISOString(),
    };
    this.registry.replace(KnowledgeGeneratorRegistryBucket.SESSION, updated);
    return updated;
  }
}
