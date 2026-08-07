import type { IPublisher } from "@aos/event-bus";

import type { KnowledgeValidatorConfig } from "../config/knowledge-validator-config.js";
import type {
  ApproveValidationInput,
  CreateValidationInput,
  CreateValidationJobInput,
  CreateValidationJobResult,
  FailValidationJobInput,
  GenerateReportInput,
  GenerateReportResult,
  ListValidationsResult,
  OpenValidatorSessionInput,
  RecordFindingInput,
  RejectValidationInput,
  ValidationJobTokenInput,
  ValidationTokenInput,
  ValidatorSessionTokenInput,
} from "../contracts/i-knowledge-validator-operations.js";
import type { KnowledgeValidationCategory } from "../domain/knowledge-validation-category.js";
import type { KnowledgeValidationConfiguration } from "../domain/knowledge-validation-configuration.js";
import {
  APPROVAL_DECISION_VALUES,
  REJECTION_DECISION_VALUES,
} from "../domain/knowledge-validation-decision-value.js";
import type { KnowledgeValidationDecision } from "../domain/knowledge-validation-decision.js";
import type { KnowledgeValidationExecution } from "../domain/knowledge-validation-execution.js";
import type { KnowledgeValidationFindingSeverity } from "../domain/knowledge-validation-finding.js";
import type { KnowledgeValidationJob } from "../domain/knowledge-validation-job.js";
import type { KnowledgeValidationPolicy } from "../domain/knowledge-validation-policy.js";
import { KnowledgeValidationRecord } from "../domain/knowledge-validation-record.js";
import type { KnowledgeValidationRule } from "../domain/knowledge-validation-rule.js";
import { KnowledgeValidationSessionState } from "../domain/knowledge-validation-session-state.js";
import type { KnowledgeValidationSession } from "../domain/knowledge-validation-session.js";
import { KnowledgeValidationState } from "../domain/knowledge-validation-state.js";
import { ValidatorDecisionException } from "../errors/validator-decision-exception.js";
import { ValidatorFindingException } from "../errors/validator-finding-exception.js";
import { ValidatorNotFoundException } from "../errors/validator-not-found-exception.js";
import { KnowledgeValidatorEventType } from "../events/knowledge-validator-event-type.js";
import { KnowledgeValidatorEvents } from "../events/knowledge-validator-events.js";
import { KnowledgeValidatorFactory } from "../factory/knowledge-validator-factory.js";
import { KnowledgeValidatorHealth } from "../health/knowledge-validator-health.js";
import { KnowledgeValidatorLifecycle } from "../lifecycle/knowledge-validator-lifecycle.js";
import { KnowledgeValidatorManager } from "../manager/knowledge-validator-manager.js";
import { KnowledgeValidatorMetrics } from "../metrics/knowledge-validator-metrics.js";
import {
  KnowledgeValidatorMiddleware,
  type ValidatorMiddleware,
} from "../middleware/knowledge-validator-middleware.js";
import { KnowledgeValidatorMonitoring } from "../monitoring/knowledge-validator-monitoring.js";
import { KnowledgeValidatorPipeline } from "../pipeline/knowledge-validator-pipeline.js";
import { KnowledgeValidatorRegistryBucket } from "../registry/knowledge-validator-registry-bucket.js";
import type { KnowledgeValidatorRegistryEntry } from "../registry/knowledge-validator-registry-entry.js";
import { KnowledgeValidatorRegistry } from "../registry/knowledge-validator-registry.js";
import { KnowledgeValidatorResolver } from "../resolver/knowledge-validator-resolver.js";
import { KnowledgeValidatorSession } from "../session/knowledge-validator-session.js";
import { KnowledgeValidatorStateMachine } from "../state-machine/knowledge-validator-state-machine.js";
import type { KnowledgeValidatorStatistics } from "../statistics/knowledge-validator-statistics.js";
import { generateKnowledgeValidatorToken } from "../token/knowledge-validator-token.js";
import { generateId } from "../utils/id.js";
import { KnowledgeValidatorValidator } from "../validator/knowledge-validator-validator.js";

/**
 * "KnowledgeValidator" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Public API") — the
 * primary API façade for the package. Wires Manager + StateMachine + Pipeline +
 * Middleware + Resolver + Validator + Events. Implements every Validation Operation as
 * a metadata/lifecycle method: validate -> drive the State Machine to the target state
 * via one atomic 10-stage Pipeline call -> record relevant domain metadata -> update
 * statistics -> publish the matching event(s) -> return the updated
 * `KnowledgeValidationRecord`. This package NEVER validates knowledge or decides an
 * outcome itself — `start()` is the ONLY method that may invoke a caller-registered
 * `IKnowledgeValidationProvider`, and `approve()`/`reject()` are the only methods that
 * record a `IKnowledgeValidationDecisionProvider`-shaped `Decision` — both only through
 * their interface methods; every other "Validation Operation" implemented here is pure
 * metadata/lifecycle work.
 */
export class KnowledgeValidator {
  readonly registry: KnowledgeValidatorRegistry;
  readonly manager: KnowledgeValidatorManager;
  readonly stateMachine: KnowledgeValidatorStateMachine;
  readonly validator: KnowledgeValidatorValidator;
  readonly pipeline: KnowledgeValidatorPipeline;
  readonly middleware: KnowledgeValidatorMiddleware;
  readonly resolver: KnowledgeValidatorResolver;
  readonly events: KnowledgeValidatorEvents;
  readonly metrics: KnowledgeValidatorMetrics;
  readonly health: KnowledgeValidatorHealth;
  readonly monitoring: KnowledgeValidatorMonitoring;
  readonly statistics: KnowledgeValidatorStatistics;
  readonly lifecycle: KnowledgeValidatorLifecycle;
  readonly factory: KnowledgeValidatorFactory;
  readonly session: KnowledgeValidatorSession;

  constructor(
    publisher: IPublisher,
    private readonly config: KnowledgeValidatorConfig = {},
  ) {
    this.registry = new KnowledgeValidatorRegistry();
    this.session = new KnowledgeValidatorSession();
    this.manager = new KnowledgeValidatorManager(this.registry, this.session);
    this.stateMachine = new KnowledgeValidatorStateMachine();
    this.metrics = new KnowledgeValidatorMetrics();
    this.validator = new KnowledgeValidatorValidator();
    this.resolver = new KnowledgeValidatorResolver(this.registry);
    this.pipeline = new KnowledgeValidatorPipeline(
      this.validator,
      this.metrics,
      this.registry,
      this.resolver,
    );
    this.middleware = new KnowledgeValidatorMiddleware();
    this.events = new KnowledgeValidatorEvents(publisher);
    this.health = new KnowledgeValidatorHealth(this.registry);
    this.monitoring = new KnowledgeValidatorMonitoring(this.metrics, this.registry);
    /* Share the Manager's Statistics instance rather than creating a second, unsynced
     * one — matching the convention established by `KnowledgeQuality`. */
    this.statistics = this.manager.statistics;
    this.lifecycle = new KnowledgeValidatorLifecycle();
    this.factory = new KnowledgeValidatorFactory();
  }

  /** Registers a `validator.use(...)` Koa-style middleware onto the shared chain. */
  use(middleware: ValidatorMiddleware): this {
    this.middleware.use(middleware);
    return this;
  }

  /** Whether a caller supplied an `IKnowledgeValidationProvider` via config — the only seam `start()` uses. */
  hasProvider(): boolean {
    return this.config.provider !== undefined;
  }

  /** Whether a caller supplied an `IKnowledgeValidationDecisionProvider` via config. */
  hasDecisionProvider(): boolean {
    return this.config.decisionProvider !== undefined;
  }

  /* ---- Setup helpers (required plumbing before a Request can reference a Rule/Policy/Configuration) ---- */

  registerRule(input: {
    readonly ruleId: string;
    readonly name: string;
    readonly tenantId: string;
    readonly category: KnowledgeValidationCategory;
    readonly description?: string;
    readonly severity?: KnowledgeValidationRule["severity"];
    readonly active?: boolean;
  }) {
    const rule = this.factory.rule.create(input);
    this.registry.register(KnowledgeValidatorRegistryBucket.RULE, rule);
    this.metrics.recordRuleUsage(0);
    return rule;
  }

  registerPolicy(input: {
    readonly policyId: string;
    readonly name: string;
    readonly tenantId: string;
    readonly allowedCategories?: readonly KnowledgeValidationCategory[];
    readonly requireApproval?: boolean;
    readonly active?: boolean;
  }): KnowledgeValidationPolicy {
    const now = new Date().toISOString();
    const policy: KnowledgeValidationPolicy = {
      id: input.policyId,
      policyId: input.policyId,
      name: input.name,
      tenantId: input.tenantId,
      allowedCategories: [...(input.allowedCategories ?? [])],
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
    readonly validationId: string;
    readonly tenantId: string;
    readonly timeoutMs?: number;
    readonly retries?: number;
    readonly maxFindings?: number;
    readonly minimumSeverity?: KnowledgeValidationConfiguration["minimumSeverity"];
    readonly custom?: Readonly<Record<string, unknown>>;
  }) {
    const configuration = {
      id: input.configurationId,
      configurationId: input.configurationId,
      validationId: input.validationId,
      tenantId: input.tenantId,
      timeoutMs: input.timeoutMs,
      retries: input.retries,
      maxFindings: input.maxFindings,
      minimumSeverity: input.minimumSeverity,
      custom: { ...input.custom },
      createdAt: new Date().toISOString(),
    };
    this.registry.register(KnowledgeValidatorRegistryBucket.CONFIGURATION, configuration);
    return configuration;
  }

  /* ---- Validation Operations ---- */

  async createValidation(input: CreateValidationInput): Promise<KnowledgeValidationRecord> {
    const token = generateKnowledgeValidatorToken();
    const validationId = generateId();
    const context = { ...input.context, token, validationId };

    const validation = this.factory.validation.create({
      token,
      validationId,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
    });

    const metadata = this.factory.metadata.create({
      validationId,
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
      validationId,
      category: input.category,
      targetReference: input.targetReference,
      ruleIds: [...(input.ruleIds ?? [])],
      policyId: input.policyId,
      configurationId: input.configurationId,
      requestedBy: input.requestedBy,
      instructions: input.instructions,
      createdAt: new Date().toISOString(),
    };

    const draft: KnowledgeValidationExecution = {
      instance: validation,
      context,
      metadata,
      request,
      resolvedRules: [],
      findings: [],
      resultMetadata: [],
      history: [],
      auditTrail: [],
      logs: [],
    };

    const pipelined = this.pipeline.run({
      execution: draft,
      operation: "create_validation",
      targetState: KnowledgeValidationState.DRAFT,
    });
    await this.middleware.run(pipelined);

    const entry: KnowledgeValidatorRegistryEntry = {
      id: pipelined.metadata.validationId,
      token,
      metadata: pipelined.metadata,
    };
    this.manager.register(token, pipelined, entry);

    await this.events.publishValidatorEvent(
      KnowledgeValidatorEventType.VALIDATION_CREATED,
      context,
    );

    return new KnowledgeValidationRecord(pipelined);
  }

  async queue(input: ValidationTokenInput): Promise<KnowledgeValidationRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "queue_validation",
      KnowledgeValidationState.QUEUED,
      input.reason,
    );
    await this.events.publishValidatorEvent(
      KnowledgeValidatorEventType.VALIDATION_QUEUED,
      execution.context,
    );
    return new KnowledgeValidationRecord(pipelined);
  }

  async prepare(input: ValidationTokenInput): Promise<KnowledgeValidationRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "prepare_validation",
      KnowledgeValidationState.PREPARING,
      input.reason,
    );
    return new KnowledgeValidationRecord(pipelined);
  }

  /**
   * Drives the Validation to Validating and, ONLY if a caller registered an
   * `IKnowledgeValidationProvider` via config, invokes it and records the returned
   * Findings. The provider is optional — this package never validates knowledge itself
   * and ships no default implementation.
   */
  async start(input: ValidationTokenInput): Promise<KnowledgeValidationRecord> {
    const execution = this.requireExecution(input.token);
    let pipelined = await this.runPipeline(
      execution,
      "start_validation",
      KnowledgeValidationState.VALIDATING,
      input.reason,
    );

    await this.events.publishValidatorEvent(
      KnowledgeValidatorEventType.VALIDATION_STARTED,
      execution.context,
    );

    if (this.config.provider) {
      const providerResult = await this.config.provider.validate(pipelined.request);
      for (const findingInput of providerResult.findings) {
        pipelined = this.appendFinding(pipelined, findingInput);
      }
      if (providerResult.findings.length > 0) {
        this.manager.update(input.token, pipelined);
      }
    }

    return new KnowledgeValidationRecord(pipelined);
  }

  /** Drives Validating -> Reviewing — the checkpoint before a Decision may be recorded via `approve()`/`reject()`. */
  async review(input: ValidationTokenInput): Promise<KnowledgeValidationRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "review_validation",
      KnowledgeValidationState.REVIEWING,
      input.reason,
    );
    return new KnowledgeValidationRecord(pipelined);
  }

  /**
   * Drives Reviewing -> Approved, recording the supplied Decision (must be `Approved`
   * or `Conditionally Approved`). Publishes BOTH `ValidationCompleted` and
   * `ValidationApproved` for this transition — a documented judgment call satisfying
   * the spec's literal event list (see docs/005.7M-KNOWLEDGE-VALIDATOR-AI-REPORT.md —
   * "Events").
   */
  async approve(input: ApproveValidationInput): Promise<KnowledgeValidationRecord> {
    const execution = this.requireExecution(input.token);
    if (!APPROVAL_DECISION_VALUES.has(input.decision.value)) {
      throw new ValidatorDecisionException(
        `Decision value "${input.decision.value}" cannot be used to approve a Validation`,
      );
    }
    const decision = this.factory.decision.create({
      validationId: execution.metadata.validationId,
      tenantId: execution.context.tenantId,
      value: input.decision.value,
      reportedBy: input.decision.reportedBy,
      confidence: input.decision.confidence,
      reason: input.decision.reason,
    });

    let pipelined = await this.runPipeline(
      execution,
      "approve_validation",
      KnowledgeValidationState.APPROVED,
      input.decision.reason,
      decision,
    );

    this.registry.register(KnowledgeValidatorRegistryBucket.DECISION, decision);
    pipelined = { ...pipelined, decision };
    this.manager.update(input.token, pipelined);

    this.metrics.recordApproved();
    this.statistics.recordApproved(pipelined.request.category);

    await this.events.publishValidatorEvent(
      KnowledgeValidatorEventType.DECISION_CREATED,
      execution.context,
      { decisionId: decision.decisionId, value: decision.value },
    );
    await this.events.publishValidatorEvent(
      KnowledgeValidatorEventType.VALIDATION_COMPLETED,
      execution.context,
    );
    await this.events.publishValidatorEvent(
      KnowledgeValidatorEventType.VALIDATION_APPROVED,
      execution.context,
    );
    return new KnowledgeValidationRecord(pipelined);
  }

  /**
   * Drives Reviewing -> Rejected, recording the supplied Decision (must be `Rejected`,
   * `Requires Revision`, `Requires Review`, or `Expired`). Publishes BOTH
   * `ValidationCompleted` and `ValidationRejected` for this transition — see
   * `approve()` for the full judgment call.
   */
  async reject(input: RejectValidationInput): Promise<KnowledgeValidationRecord> {
    const execution = this.requireExecution(input.token);
    if (!REJECTION_DECISION_VALUES.has(input.decision.value)) {
      throw new ValidatorDecisionException(
        `Decision value "${input.decision.value}" cannot be used to reject a Validation`,
      );
    }
    const decision = this.factory.decision.create({
      validationId: execution.metadata.validationId,
      tenantId: execution.context.tenantId,
      value: input.decision.value,
      reportedBy: input.decision.reportedBy,
      confidence: input.decision.confidence,
      reason: input.decision.reason,
    });

    let pipelined = await this.runPipeline(
      execution,
      "reject_validation",
      KnowledgeValidationState.REJECTED,
      input.decision.reason,
      decision,
    );

    this.registry.register(KnowledgeValidatorRegistryBucket.DECISION, decision);
    pipelined = { ...pipelined, decision };
    this.manager.update(input.token, pipelined);

    this.metrics.recordRejected();
    this.statistics.recordRejected(pipelined.request.category);

    await this.events.publishValidatorEvent(
      KnowledgeValidatorEventType.DECISION_CREATED,
      execution.context,
      { decisionId: decision.decisionId, value: decision.value },
    );
    await this.events.publishValidatorEvent(
      KnowledgeValidatorEventType.VALIDATION_COMPLETED,
      execution.context,
    );
    await this.events.publishValidatorEvent(
      KnowledgeValidatorEventType.VALIDATION_REJECTED,
      execution.context,
    );
    return new KnowledgeValidationRecord(pipelined);
  }

  async cancel(input: ValidationTokenInput): Promise<KnowledgeValidationRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "cancel_validation",
      KnowledgeValidationState.CANCELLED,
      input.reason,
    );
    await this.events.publishValidatorEvent(
      KnowledgeValidatorEventType.VALIDATION_CANCELLED,
      execution.context,
    );
    return new KnowledgeValidationRecord(pipelined);
  }

  async archive(input: ValidationTokenInput): Promise<KnowledgeValidationRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "archive_validation",
      KnowledgeValidationState.ARCHIVED,
      input.reason,
    );
    await this.events.publishValidatorEvent(
      KnowledgeValidatorEventType.VALIDATION_ARCHIVED,
      execution.context,
    );
    return new KnowledgeValidationRecord(pipelined);
  }

  async destroy(input: ValidationTokenInput): Promise<KnowledgeValidationRecord> {
    const execution = this.requireExecution(input.token);
    const pipelined = await this.runPipeline(
      execution,
      "destroy_validation",
      KnowledgeValidationState.DESTROYED,
      input.reason,
    );
    await this.events.publishValidatorEvent(
      KnowledgeValidatorEventType.VALIDATION_DESTROYED,
      execution.context,
    );
    return new KnowledgeValidationRecord(pipelined);
  }

  /* ---- Finding Operations ---- */

  async recordFinding(input: RecordFindingInput): Promise<KnowledgeValidationRecord> {
    const execution = this.requireExecution(input.token);
    if (
      execution.instance.state !== KnowledgeValidationState.VALIDATING &&
      execution.instance.state !== KnowledgeValidationState.REVIEWING
    ) {
      throw new ValidatorFindingException(
        `Cannot record a Finding for Validation "${execution.metadata.validationId}": it is "${execution.instance.state}", not Validating/Reviewing`,
      );
    }
    const updated = this.appendFinding(execution, {
      category: input.category,
      severity: input.severity,
      description: input.description,
      locationReference: input.locationReference,
      ruleId: input.ruleId,
    });
    this.manager.update(input.token, updated);
    return new KnowledgeValidationRecord(updated);
  }

  /* ---- Report Operations ---- */

  async generateReport(input: GenerateReportInput): Promise<GenerateReportResult> {
    const execution = this.requireExecution(input.token);
    const report = this.factory.report.create({
      validationId: execution.metadata.validationId,
      tenantId: execution.context.tenantId,
      findingIds: execution.findings.map((finding) => finding.findingId),
      decisionId: execution.decision?.decisionId,
      summary: input.summary,
    });
    const updated: KnowledgeValidationExecution = { ...execution, report };
    this.manager.update(input.token, updated);
    await this.events.publishValidatorEvent(
      KnowledgeValidatorEventType.REPORT_GENERATED,
      updated.context,
    );
    return { report };
  }

  /* ---- Session Operations ---- */

  openSession(input: OpenValidatorSessionInput): KnowledgeValidationSession {
    const execution = this.requireExecution(input.token);
    this.session.open(input.token, input.holder, input.ttlMs);
    const now = new Date();
    const domainSession: KnowledgeValidationSession = {
      id: input.token,
      sessionId: generateId(),
      validationId: execution.metadata.validationId,
      tenantId: execution.context.tenantId,
      holder: input.holder,
      state: KnowledgeValidationSessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: input.ttlMs ? new Date(now.getTime() + input.ttlMs).toISOString() : undefined,
    };
    this.registry.register(KnowledgeValidatorRegistryBucket.SESSION, domainSession);
    return domainSession;
  }

  closeSession(input: ValidatorSessionTokenInput): KnowledgeValidationSession {
    this.session.close(input.token);
    return this.transitionSession(input.token, KnowledgeValidationSessionState.CLOSED);
  }

  cancelSession(input: ValidatorSessionTokenInput): KnowledgeValidationSession {
    this.session.cancel(input.token);
    return this.transitionSession(input.token, KnowledgeValidationSessionState.CANCELLED);
  }

  expireSession(input: ValidatorSessionTokenInput): KnowledgeValidationSession {
    this.session.expire(input.token);
    return this.transitionSession(input.token, KnowledgeValidationSessionState.EXPIRED);
  }

  renewSession(input: ValidatorSessionTokenInput): KnowledgeValidationSession {
    const ledger = this.session.renew(input.token, input.ttlMs);
    const existing = this.registry.require<KnowledgeValidationSession>(
      KnowledgeValidatorRegistryBucket.SESSION,
      input.token,
    );
    const updated: KnowledgeValidationSession = { ...existing, expiresAt: ledger.expiresAt };
    this.registry.replace(KnowledgeValidatorRegistryBucket.SESSION, updated);
    return updated;
  }

  /* ---- Job Operations ---- */

  createJob(input: CreateValidationJobInput): CreateValidationJobResult {
    const jobId = generateId();
    const job: KnowledgeValidationJob = {
      id: jobId,
      jobId,
      validationId: input.validationId,
      tenantId: input.tenantId,
      priority: input.priority ?? 5,
      scheduledAt: input.scheduledAt,
      createdAt: new Date().toISOString(),
    };
    this.manager.registerJob(job);
    return { job };
  }

  completeJob(input: ValidationJobTokenInput): KnowledgeValidationJob {
    const job = this.manager.requireJob(input.jobId);
    return this.manager.updateJob({ ...job, completedAt: new Date().toISOString() });
  }

  failJob(input: FailValidationJobInput): KnowledgeValidationJob {
    const job = this.manager.requireJob(input.jobId);
    return this.manager.updateJob({
      ...job,
      failedAt: new Date().toISOString(),
      failureReason: input.reason,
    });
  }

  /* ---- Read Operations ---- */

  get(token: string): KnowledgeValidationRecord | undefined {
    const execution = this.manager.get(token);
    return execution ? new KnowledgeValidationRecord(execution) : undefined;
  }

  require(token: string): KnowledgeValidationRecord {
    return new KnowledgeValidationRecord(this.requireExecution(token));
  }

  list(): ListValidationsResult {
    return {
      validations: this.manager.list().map((execution) => new KnowledgeValidationRecord(execution)),
    };
  }

  count(): number {
    return this.manager.count();
  }

  /* ---- Private helpers ---- */

  /** Runs the 10-stage Pipeline, the Middleware chain, and persists the result via the Manager. */
  private async runPipeline(
    execution: KnowledgeValidationExecution,
    operation: string,
    targetState?: KnowledgeValidationState,
    reason?: string,
    decision?: KnowledgeValidationDecision,
  ): Promise<KnowledgeValidationExecution> {
    const result = this.pipeline.run({
      execution,
      operation,
      targetState,
      reason,
      decision,
    });
    await this.middleware.run(result);
    this.manager.update(execution.instance.token, result);
    this.registry.replace(KnowledgeValidatorRegistryBucket.VALIDATION, {
      id: result.metadata.validationId,
      token: result.instance.token,
      metadata: result.metadata,
    });
    return result;
  }

  private appendFinding(
    execution: KnowledgeValidationExecution,
    input: {
      readonly category: KnowledgeValidationCategory;
      readonly severity: KnowledgeValidationFindingSeverity;
      readonly description: string;
      readonly locationReference?: string;
      readonly ruleId?: string;
    },
  ): KnowledgeValidationExecution {
    const finding = this.factory.finding.create({
      validationId: execution.metadata.validationId,
      tenantId: execution.context.tenantId,
      category: input.category,
      severity: input.severity,
      description: input.description,
      locationReference: input.locationReference,
      ruleId: input.ruleId,
    });
    this.registry.register(KnowledgeValidatorRegistryBucket.FINDING, finding);
    this.metrics.recordFinding();
    return { ...execution, findings: [...execution.findings, finding] };
  }

  private requireExecution(token: string): KnowledgeValidationExecution {
    const execution = this.manager.get(token);
    if (!execution) {
      throw new ValidatorNotFoundException(`No Validation is registered for Token "${token}"`);
    }
    return execution;
  }

  private transitionSession(
    token: string,
    state: KnowledgeValidationSessionState,
  ): KnowledgeValidationSession {
    const existing = this.registry.require<KnowledgeValidationSession>(
      KnowledgeValidatorRegistryBucket.SESSION,
      token,
    );
    const updated: KnowledgeValidationSession = {
      ...existing,
      state,
      closedAt: new Date().toISOString(),
    };
    this.registry.replace(KnowledgeValidatorRegistryBucket.SESSION, updated);
    return updated;
  }
}
