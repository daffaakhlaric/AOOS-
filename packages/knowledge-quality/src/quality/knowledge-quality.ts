import type { IPublisher } from "@aos/event-bus";

import type { KnowledgeQualityConfig } from "../config/knowledge-quality-config.js";
import type {
  CompleteAssessmentInput,
  CreateAssessmentInput,
  CreateAssessmentJobInput,
  CreateAssessmentJobResult,
  FailAssessmentInput,
  FailAssessmentJobInput,
  AssessmentJobTokenInput,
  AssessmentTokenInput,
  QualitySessionTokenInput,
  GenerateReportInput,
  GenerateReportResult,
  ListAssessmentsResult,
  OpenQualitySessionInput,
  RecordFindingInput,
} from "../contracts/i-knowledge-quality-operations.js";
import type { KnowledgeQualityAssessmentJob } from "../domain/knowledge-quality-assessment-job.js";
import type { KnowledgeQualityAssessmentMode } from "../domain/knowledge-quality-assessment-mode.js";
import { KnowledgeQualityAssessmentRecord } from "../domain/knowledge-quality-assessment-record.js";
import type { KnowledgeQualityAssessmentSession } from "../domain/knowledge-quality-assessment-session.js";
import { KnowledgeQualityAssessmentState } from "../domain/knowledge-quality-assessment-state.js";
import type { KnowledgeQualityConfiguration } from "../domain/knowledge-quality-configuration.js";
import type { KnowledgeQualityDimension } from "../domain/knowledge-quality-dimension.js";
import type { KnowledgeQualityExecution } from "../domain/knowledge-quality-execution.js";
import type { KnowledgeQualityPolicy } from "../domain/knowledge-quality-policy.js";
import type { KnowledgeQualityProfile } from "../domain/knowledge-quality-profile.js";
import type { KnowledgeQualityRule } from "../domain/knowledge-quality-rule.js";
import { KnowledgeQualitySessionState } from "../domain/knowledge-quality-session-state.js";
import { QualityFindingException } from "../errors/quality-finding-exception.js";
import { QualityNotFoundException } from "../errors/quality-not-found-exception.js";
import { KnowledgeQualityEventType } from "../events/knowledge-quality-event-type.js";
import { KnowledgeQualityEvents } from "../events/knowledge-quality-events.js";
import { KnowledgeQualityFactory } from "../factory/knowledge-quality-factory.js";
import { KnowledgeQualityHealth } from "../health/knowledge-quality-health.js";
import { KnowledgeQualityLifecycle } from "../lifecycle/knowledge-quality-lifecycle.js";
import { KnowledgeQualityManager } from "../manager/knowledge-quality-manager.js";
import { KnowledgeQualityMetrics } from "../metrics/knowledge-quality-metrics.js";
import {
  KnowledgeQualityMiddleware,
  type QualityMiddleware,
} from "../middleware/knowledge-quality-middleware.js";
import { KnowledgeQualityMonitoring } from "../monitoring/knowledge-quality-monitoring.js";
import { KnowledgeQualityPipeline } from "../pipeline/knowledge-quality-pipeline.js";
import { KnowledgeQualityRegistryBucket } from "../registry/knowledge-quality-registry-bucket.js";
import type { KnowledgeQualityRegistryEntry } from "../registry/knowledge-quality-registry-entry.js";
import { KnowledgeQualityRegistry } from "../registry/knowledge-quality-registry.js";
import { KnowledgeQualityResolver } from "../resolver/knowledge-quality-resolver.js";
import { KnowledgeQualitySession } from "../session/knowledge-quality-session.js";
import { KnowledgeQualityStateMachine } from "../state-machine/knowledge-quality-state-machine.js";
import type { KnowledgeQualityStatistics } from "../statistics/knowledge-quality-statistics.js";
import { generateKnowledgeQualityToken } from "../token/knowledge-quality-token.js";
import { generateId } from "../utils/id.js";
import { KnowledgeQualityValidator } from "../validator/knowledge-quality-validator.js";

/**
 * "KnowledgeQuality" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Public API") — the
 * primary API façade for the package, analogous in role to `KnowledgeMarketplace` in
 * `@aos/knowledge-marketplace`. Wires Manager + StateMachine + Pipeline + Middleware +
 * Resolver + Validator + Events. Implements every Assessment Operation as a
 * metadata/lifecycle method: validate -> drive the State Machine to the target state
 * via one atomic 10-stage Pipeline call -> record relevant domain metadata -> update
 * statistics -> publish the matching event -> return the updated
 * `KnowledgeQualityAssessmentRecord`. This package NEVER evaluates quality itself —
 * `start()` is the ONLY method that may invoke a caller-registered
 * `IKnowledgeQualityProvider`/`IKnowledgeQualityScoringProvider`, and only through
 * their interface methods; every "Assessment Operation" otherwise implemented here is
 * pure metadata/lifecycle work.
 */
export class KnowledgeQuality {
  readonly registry: KnowledgeQualityRegistry;
  readonly manager: KnowledgeQualityManager;
  readonly stateMachine: KnowledgeQualityStateMachine;
  readonly validator: KnowledgeQualityValidator;
  readonly pipeline: KnowledgeQualityPipeline;
  readonly middleware: KnowledgeQualityMiddleware;
  readonly resolver: KnowledgeQualityResolver;
  readonly events: KnowledgeQualityEvents;
  readonly metrics: KnowledgeQualityMetrics;
  readonly health: KnowledgeQualityHealth;
  readonly monitoring: KnowledgeQualityMonitoring;
  readonly statistics: KnowledgeQualityStatistics;
  readonly lifecycle: KnowledgeQualityLifecycle;
  readonly factory: KnowledgeQualityFactory;
  readonly session: KnowledgeQualitySession;

  constructor(
    publisher: IPublisher,
    private readonly config: KnowledgeQualityConfig = {},
  ) {
    this.registry = new KnowledgeQualityRegistry();
    this.session = new KnowledgeQualitySession();
    this.manager = new KnowledgeQualityManager(this.registry, this.session);
    this.stateMachine = new KnowledgeQualityStateMachine();
    this.metrics = new KnowledgeQualityMetrics();
    this.validator = new KnowledgeQualityValidator();
    this.resolver = new KnowledgeQualityResolver(this.registry);
    this.pipeline = new KnowledgeQualityPipeline(
      this.validator,
      this.metrics,
      this.registry,
      this.resolver,
    );
    this.middleware = new KnowledgeQualityMiddleware();
    this.events = new KnowledgeQualityEvents(publisher);
    this.health = new KnowledgeQualityHealth(this.registry);
    this.monitoring = new KnowledgeQualityMonitoring(this.metrics, this.registry);
    /* Share the Manager's Statistics instance rather than creating a second, unsynced
     * one — matching the convention established by `KnowledgeMarketplace`. */
    this.statistics = this.manager.statistics;
    this.lifecycle = new KnowledgeQualityLifecycle();
    this.factory = new KnowledgeQualityFactory();
  }

  /** Registers a `quality.use(...)` Koa-style middleware onto the shared chain. */
  use(middleware: QualityMiddleware): this {
    this.middleware.use(middleware);
    return this;
  }

  /** Whether a caller supplied an `IKnowledgeQualityProvider` via config — the only seam `start()` uses. */
  hasProvider(): boolean {
    return this.config.provider !== undefined;
  }

  /** Whether a caller supplied an `IKnowledgeQualityScoringProvider` via config — the only seam `start()` uses to record Score Metadata. */
  hasScoringProvider(): boolean {
    return this.config.scoringProvider !== undefined;
  }

  /* ---- Setup helpers (required plumbing before a Request can reference a Rule/Profile/Policy/Configuration) ---- */

  registerRule(input: {
    readonly ruleId: string;
    readonly name: string;
    readonly tenantId: string;
    readonly dimension: KnowledgeQualityDimension;
    readonly description?: string;
    readonly severity?: KnowledgeQualityRule["severity"];
    readonly active?: boolean;
  }): KnowledgeQualityRule {
    const rule = this.factory.rule.create(input);
    this.registry.register(KnowledgeQualityRegistryBucket.RULE, rule);
    this.metrics.recordRuleUsage(0);
    return rule;
  }

  registerProfile(input: {
    readonly profileId: string;
    readonly name: string;
    readonly tenantId: string;
    readonly ruleIds?: readonly string[];
    readonly dimensionWeights?: Readonly<Partial<Record<KnowledgeQualityDimension, number>>>;
    readonly description?: string;
    readonly active?: boolean;
  }): KnowledgeQualityProfile {
    const profile = this.factory.profile.create(input);
    this.registry.register(KnowledgeQualityRegistryBucket.PROFILE, profile);
    return profile;
  }

  registerPolicy(input: {
    readonly policyId: string;
    readonly name: string;
    readonly tenantId: string;
    readonly allowedDimensions?: readonly KnowledgeQualityDimension[];
    readonly allowedModes?: readonly KnowledgeQualityAssessmentMode[];
    readonly requireApproval?: boolean;
    readonly active?: boolean;
  }): KnowledgeQualityPolicy {
    const now = new Date().toISOString();
    const policy: KnowledgeQualityPolicy = {
      id: input.policyId,
      policyId: input.policyId,
      name: input.name,
      tenantId: input.tenantId,
      allowedDimensions: [...(input.allowedDimensions ?? [])],
      allowedModes: [...(input.allowedModes ?? [])],
      requireApproval: input.requireApproval ?? false,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.resolver.registerPolicy(policy);
    return policy;
  }

  registerConfiguration(input: {
    readonly configurationId: string;
    readonly assessmentId: string;
    readonly tenantId: string;
    readonly timeoutMs?: number;
    readonly retries?: number;
    readonly maxFindings?: number;
    readonly minimumSeverity?: KnowledgeQualityConfiguration["minimumSeverity"];
    readonly custom?: Readonly<Record<string, unknown>>;
  }) {
    const configuration = {
      id: input.configurationId,
      configurationId: input.configurationId,
      assessmentId: input.assessmentId,
      tenantId: input.tenantId,
      timeoutMs: input.timeoutMs,
      retries: input.retries,
      maxFindings: input.maxFindings,
      minimumSeverity: input.minimumSeverity,
      custom: { ...input.custom },
      createdAt: new Date().toISOString(),
    };
    this.registry.register(KnowledgeQualityRegistryBucket.CONFIGURATION, configuration);
    return configuration;
  }

  /* ---- Assessment Operations ---- */

  async createAssessment(input: CreateAssessmentInput): Promise<KnowledgeQualityAssessmentRecord> {
    const token = generateKnowledgeQualityToken();
    const assessmentId = generateId();
    const context = { ...input.context, token, assessmentId };

    const assessment = this.factory.assessment.create({
      token,
      assessmentId,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
    });

    const metadata = this.factory.metadata.create({
      assessmentId,
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
      assessmentId,
      mode: input.mode,
      targetReference: input.targetReference,
      ruleIds: [...(input.ruleIds ?? [])],
      profileId: input.profileId,
      policyId: input.policyId,
      configurationId: input.configurationId,
      requestedBy: input.requestedBy,
      instructions: input.instructions,
      createdAt: new Date().toISOString(),
    };

    const draft: KnowledgeQualityExecution = {
      instance: assessment,
      context,
      metadata,
      request,
      resolvedRules: [],
      findings: [],
      scoreMetadata: [],
      history: [],
      auditTrail: [],
      logs: [],
    };

    const pipelined = this.pipeline.run({
      execution: draft,
      operation: "create_assessment",
      targetState: KnowledgeQualityAssessmentState.DRAFT,
    });
    await this.middleware.run(pipelined);

    const entry: KnowledgeQualityRegistryEntry = {
      id: pipelined.metadata.assessmentId,
      token,
      metadata: pipelined.metadata,
    };
    this.manager.register(token, pipelined, entry);

    await this.events.publishQualityEvent(KnowledgeQualityEventType.ASSESSMENT_CREATED, context);

    return new KnowledgeQualityAssessmentRecord(pipelined);
  }

  async queue(input: AssessmentTokenInput): Promise<KnowledgeQualityAssessmentRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "queue_assessment",
      KnowledgeQualityAssessmentState.QUEUED,
      input.reason,
    );
    await this.events.publishQualityEvent(
      KnowledgeQualityEventType.ASSESSMENT_QUEUED,
      execution.context,
    );
    return new KnowledgeQualityAssessmentRecord(pipelined);
  }

  async prepare(input: AssessmentTokenInput): Promise<KnowledgeQualityAssessmentRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "prepare_assessment",
      KnowledgeQualityAssessmentState.PREPARING,
      input.reason,
    );
    return new KnowledgeQualityAssessmentRecord(pipelined);
  }

  /**
   * Drives the Assessment to Assessing and, ONLY if a caller registered an
   * `IKnowledgeQualityProvider`/`IKnowledgeQualityScoringProvider` via config, invokes
   * them and records the returned Findings/Score Metadata. Both providers are optional
   * — this package never evaluates quality itself and ships no default implementation.
   */
  async start(input: AssessmentTokenInput): Promise<KnowledgeQualityAssessmentRecord> {
    const execution = this.requireExecution(input.token);
    let pipelined = await this.runPipeline(
      execution,
      "start_assessment",
      KnowledgeQualityAssessmentState.ASSESSING,
      input.reason,
    );

    await this.events.publishQualityEvent(
      KnowledgeQualityEventType.ASSESSMENT_STARTED,
      execution.context,
    );

    if (this.config.provider) {
      const providerResult = await this.config.provider.assess(pipelined.request);
      for (const findingInput of providerResult.findings) {
        pipelined = this.appendFinding(pipelined, findingInput);
      }
      if (providerResult.findings.length > 0) {
        this.manager.update(input.token, pipelined);
      }
    }

    if (this.config.scoringProvider) {
      const scores = await this.config.scoringProvider.score(pipelined.request);
      for (const score of scores) {
        const scoreMetadata = {
          id: generateId(),
          scoreId: generateId(),
          assessmentId: pipelined.metadata.assessmentId,
          tenantId: pipelined.context.tenantId,
          dimension: score.dimension,
          value: score.value,
          qualitativeValue: score.qualitativeValue,
          providerId: score.providerId,
          recordedAt: new Date().toISOString(),
        };
        pipelined = { ...pipelined, scoreMetadata: [...pipelined.scoreMetadata, scoreMetadata] };
        if (score.value !== undefined) {
          this.metrics.recordScore(score.value);
        }
      }
      if (scores.length > 0) {
        this.manager.update(input.token, pipelined);
      }
    }

    return new KnowledgeQualityAssessmentRecord(pipelined);
  }

  /** Drives Assessing -> Reviewing — the optional human/automated review checkpoint before `complete()`. */
  async review(input: AssessmentTokenInput): Promise<KnowledgeQualityAssessmentRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "review_assessment",
      KnowledgeQualityAssessmentState.REVIEWING,
      input.reason,
    );
    return new KnowledgeQualityAssessmentRecord(pipelined);
  }

  async complete(input: CompleteAssessmentInput): Promise<KnowledgeQualityAssessmentRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "complete_assessment",
      KnowledgeQualityAssessmentState.COMPLETED,
      input.reason,
    );
    this.metrics.recordCompleted();
    this.statistics.recordCompleted(pipelined.request.mode);
    if (pipelined.instance.startedAt) {
      const durationMs =
        Date.parse(pipelined.instance.completedAt ?? new Date().toISOString()) -
        Date.parse(pipelined.instance.startedAt);
      if (durationMs >= 0) {
        this.metrics.recordDuration(durationMs);
      }
    }

    await this.events.publishQualityEvent(
      KnowledgeQualityEventType.ASSESSMENT_COMPLETED,
      execution.context,
    );
    return new KnowledgeQualityAssessmentRecord(pipelined);
  }

  async fail(input: FailAssessmentInput): Promise<KnowledgeQualityAssessmentRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "fail_assessment",
      KnowledgeQualityAssessmentState.FAILED,
      input.reason,
    );
    this.metrics.recordFailed();
    this.statistics.recordFailed(pipelined.request.mode);

    await this.events.publishQualityEvent(
      KnowledgeQualityEventType.ASSESSMENT_FAILED,
      execution.context,
      { reason: input.reason },
    );
    return new KnowledgeQualityAssessmentRecord(pipelined);
  }

  async cancel(input: AssessmentTokenInput): Promise<KnowledgeQualityAssessmentRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "cancel_assessment",
      KnowledgeQualityAssessmentState.CANCELLED,
      input.reason,
    );
    await this.events.publishQualityEvent(
      KnowledgeQualityEventType.ASSESSMENT_CANCELLED,
      execution.context,
    );
    return new KnowledgeQualityAssessmentRecord(pipelined);
  }

  async archive(input: AssessmentTokenInput): Promise<KnowledgeQualityAssessmentRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "archive_assessment",
      KnowledgeQualityAssessmentState.ARCHIVED,
      input.reason,
    );
    await this.events.publishQualityEvent(
      KnowledgeQualityEventType.ASSESSMENT_ARCHIVED,
      execution.context,
    );
    return new KnowledgeQualityAssessmentRecord(pipelined);
  }

  async destroy(input: AssessmentTokenInput): Promise<KnowledgeQualityAssessmentRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "destroy_assessment",
      KnowledgeQualityAssessmentState.DESTROYED,
      input.reason,
    );
    await this.events.publishQualityEvent(
      KnowledgeQualityEventType.ASSESSMENT_DESTROYED,
      execution.context,
    );
    return new KnowledgeQualityAssessmentRecord(pipelined);
  }

  /* ---- Finding Operations ---- */

  async recordFinding(input: RecordFindingInput): Promise<KnowledgeQualityAssessmentRecord> {
    const execution = this.requireExecution(input.token);
    if (
      execution.instance.state !== KnowledgeQualityAssessmentState.ASSESSING &&
      execution.instance.state !== KnowledgeQualityAssessmentState.REVIEWING
    ) {
      throw new QualityFindingException(
        `Cannot record a Finding for Assessment "${execution.metadata.assessmentId}": it is "${execution.instance.state}", not Assessing/Reviewing`,
      );
    }
    const updated = this.appendFinding(execution, {
      dimension: input.dimension,
      severity: input.severity,
      description: input.description,
      locationReference: input.locationReference,
      ruleId: input.ruleId,
    });
    this.manager.update(input.token, updated);
    await this.events.publishQualityEvent(
      KnowledgeQualityEventType.FINDING_CREATED,
      updated.context,
    );
    return new KnowledgeQualityAssessmentRecord(updated);
  }

  /* ---- Report Operations ---- */

  async generateReport(input: GenerateReportInput): Promise<GenerateReportResult> {
    const execution = this.requireExecution(input.token);
    const report = this.factory.report.create({
      assessmentId: execution.metadata.assessmentId,
      tenantId: execution.context.tenantId,
      findingIds: execution.findings.map((finding) => finding.findingId),
      scoreMetadataIds: execution.scoreMetadata.map((score) => score.scoreId),
      summary: input.summary,
    });
    const updated: KnowledgeQualityExecution = { ...execution, report };
    this.manager.update(input.token, updated);
    await this.events.publishQualityEvent(
      KnowledgeQualityEventType.REPORT_GENERATED,
      updated.context,
    );
    return { report };
  }

  /* ---- Session Operations ---- */

  openSession(input: OpenQualitySessionInput): KnowledgeQualityAssessmentSession {
    const execution = this.requireExecution(input.token);
    this.session.open(input.token, input.holder, input.ttlMs);
    const now = new Date();
    const domainSession: KnowledgeQualityAssessmentSession = {
      id: input.token,
      sessionId: generateId(),
      assessmentId: execution.metadata.assessmentId,
      tenantId: execution.context.tenantId,
      holder: input.holder,
      state: KnowledgeQualitySessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: input.ttlMs ? new Date(now.getTime() + input.ttlMs).toISOString() : undefined,
    };
    this.registry.register(KnowledgeQualityRegistryBucket.SESSION, domainSession);
    return domainSession;
  }

  closeSession(input: QualitySessionTokenInput): KnowledgeQualityAssessmentSession {
    this.session.close(input.token);
    return this.transitionSession(input.token, KnowledgeQualitySessionState.CLOSED);
  }

  cancelSession(input: QualitySessionTokenInput): KnowledgeQualityAssessmentSession {
    this.session.cancel(input.token);
    return this.transitionSession(input.token, KnowledgeQualitySessionState.CANCELLED);
  }

  expireSession(input: QualitySessionTokenInput): KnowledgeQualityAssessmentSession {
    this.session.expire(input.token);
    return this.transitionSession(input.token, KnowledgeQualitySessionState.EXPIRED);
  }

  renewSession(input: QualitySessionTokenInput): KnowledgeQualityAssessmentSession {
    const ledger = this.session.renew(input.token, input.ttlMs);
    const existing = this.registry.require<KnowledgeQualityAssessmentSession>(
      KnowledgeQualityRegistryBucket.SESSION,
      input.token,
    );
    const updated: KnowledgeQualityAssessmentSession = { ...existing, expiresAt: ledger.expiresAt };
    this.registry.replace(KnowledgeQualityRegistryBucket.SESSION, updated);
    return updated;
  }

  /* ---- Job Operations ---- */

  createJob(input: CreateAssessmentJobInput): CreateAssessmentJobResult {
    const jobId = generateId();
    const job: KnowledgeQualityAssessmentJob = {
      id: jobId,
      jobId,
      assessmentId: input.assessmentId,
      tenantId: input.tenantId,
      priority: input.priority ?? 5,
      scheduledAt: input.scheduledAt,
      createdAt: new Date().toISOString(),
    };
    this.manager.registerJob(job);
    return { job };
  }

  completeJob(input: AssessmentJobTokenInput): KnowledgeQualityAssessmentJob {
    const job = this.manager.requireJob(input.jobId);
    return this.manager.updateJob({ ...job, completedAt: new Date().toISOString() });
  }

  failJob(input: FailAssessmentJobInput): KnowledgeQualityAssessmentJob {
    const job = this.manager.requireJob(input.jobId);
    return this.manager.updateJob({
      ...job,
      failedAt: new Date().toISOString(),
      failureReason: input.reason,
    });
  }

  /* ---- Read Operations ---- */

  get(token: string): KnowledgeQualityAssessmentRecord | undefined {
    const execution = this.manager.get(token);
    return execution ? new KnowledgeQualityAssessmentRecord(execution) : undefined;
  }

  require(token: string): KnowledgeQualityAssessmentRecord {
    return new KnowledgeQualityAssessmentRecord(this.requireExecution(token));
  }

  list(): ListAssessmentsResult {
    return {
      assessments: this.manager
        .list()
        .map((execution) => new KnowledgeQualityAssessmentRecord(execution)),
    };
  }

  count(): number {
    return this.manager.count();
  }

  /* ---- Private helpers ---- */

  /** Runs the 10-stage Pipeline, the Middleware chain, and persists the result via the Manager. */
  private async runPipeline(
    execution: KnowledgeQualityExecution,
    operation: string,
    targetState?: KnowledgeQualityAssessmentState,
    reason?: string,
  ): Promise<KnowledgeQualityExecution> {
    const result = this.pipeline.run({
      execution,
      operation,
      targetState,
      reason,
    });
    await this.middleware.run(result);
    this.manager.update(execution.instance.token, result);
    this.registry.replace(KnowledgeQualityRegistryBucket.ASSESSMENT, {
      id: result.metadata.assessmentId,
      token: result.instance.token,
      metadata: result.metadata,
    });
    return result;
  }

  private appendFinding(
    execution: KnowledgeQualityExecution,
    input: {
      readonly dimension: KnowledgeQualityDimension;
      readonly severity: KnowledgeQualityRule["severity"];
      readonly description: string;
      readonly locationReference?: string;
      readonly ruleId?: string;
    },
  ): KnowledgeQualityExecution {
    const finding = this.factory.finding.create({
      assessmentId: execution.metadata.assessmentId,
      tenantId: execution.context.tenantId,
      dimension: input.dimension,
      severity: input.severity,
      description: input.description,
      locationReference: input.locationReference,
      ruleId: input.ruleId,
    });
    this.registry.register(KnowledgeQualityRegistryBucket.FINDING, finding);
    this.metrics.recordFinding();
    return { ...execution, findings: [...execution.findings, finding] };
  }

  private requireExecution(token: string): KnowledgeQualityExecution {
    const execution = this.manager.get(token);
    if (!execution) {
      throw new QualityNotFoundException(`No Assessment is registered for Token "${token}"`);
    }
    return execution;
  }

  private transitionSession(
    token: string,
    state: KnowledgeQualitySessionState,
  ): KnowledgeQualityAssessmentSession {
    const existing = this.registry.require<KnowledgeQualityAssessmentSession>(
      KnowledgeQualityRegistryBucket.SESSION,
      token,
    );
    const updated: KnowledgeQualityAssessmentSession = {
      ...existing,
      state,
      closedAt: new Date().toISOString(),
    };
    this.registry.replace(KnowledgeQualityRegistryBucket.SESSION, updated);
    return updated;
  }
}
