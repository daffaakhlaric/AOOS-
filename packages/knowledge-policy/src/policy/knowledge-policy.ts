import type { IPublisher } from "@aos/event-bus";

import type { KnowledgePolicyContext } from "../context/knowledge-policy-context.js";
import type {
  ActivatePolicyInput,
  ArchivePolicyInput,
  AssignPolicyInput,
  AssignPolicyResult,
  CreatePolicyInput,
  DestroyPolicyInput,
  EvaluatePolicyInput,
  EvaluatePolicyResult,
  RestorePolicyInput,
  SuspendPolicyInput,
  UnassignPolicyInput,
  ValidatePolicyInput,
} from "../contracts/i-knowledge-policy-operations.js";
import type { KnowledgePolicyValidationResult } from "../contracts/i-knowledge-policy-validator.js";
import { KnowledgePolicyEvaluationResult } from "../domain/knowledge-policy-evaluation.js";
import type { KnowledgePolicyExecution } from "../domain/knowledge-policy-execution.js";
import { KnowledgePolicyRecord } from "../domain/knowledge-policy-record.js";
import { KnowledgePolicyState } from "../domain/knowledge-policy-state.js";
import { PolicyNotFoundException } from "../errors/policy-not-found-exception.js";
import { PolicyPermissionDeniedException } from "../errors/policy-permission-denied-exception.js";
import { KnowledgePolicyEventType } from "../events/knowledge-policy-event-type.js";
import { KnowledgePolicyEvents } from "../events/knowledge-policy-events.js";
import { KnowledgePolicyFactory } from "../factory/knowledge-policy-factory.js";
import { KnowledgePolicyHealth } from "../health/knowledge-policy-health.js";
import { KnowledgePolicyLifecycle } from "../lifecycle/knowledge-policy-lifecycle.js";
import { KnowledgePolicyManager } from "../manager/knowledge-policy-manager.js";
import { KnowledgePolicyMetrics } from "../metrics/knowledge-policy-metrics.js";
import {
  KnowledgePolicyMiddleware,
  type PolicyMiddleware,
} from "../middleware/knowledge-policy-middleware.js";
import { KnowledgePolicyMonitoring } from "../monitoring/knowledge-policy-monitoring.js";
import { KnowledgePolicyPipeline } from "../pipeline/knowledge-policy-pipeline.js";
import { KnowledgePolicyRegistryBucket } from "../registry/knowledge-policy-registry-bucket.js";
import { KnowledgePolicyRegistry } from "../registry/knowledge-policy-registry.js";
import type { PolicyRegistryEntry } from "../registry/policy-registry-entry.js";
import { KnowledgePolicyResolver } from "../resolver/knowledge-policy-resolver.js";
import { KnowledgePolicySession } from "../session/knowledge-policy-session.js";
import { KnowledgePolicyStateMachine } from "../state-machine/knowledge-policy-state-machine.js";
import { KnowledgePolicyStatistics } from "../statistics/knowledge-policy-statistics.js";
import { generateKnowledgePolicyToken } from "../token/knowledge-policy-token.js";
import { generateId } from "../utils/id.js";
import { KnowledgePolicyValidator } from "../validator/knowledge-policy-validator.js";

import { KnowledgePolicyPermission } from "./knowledge-policy-permission.js";

/**
 * "KnowledgePolicy" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Public API") — the
 * primary API façade for the package, analogous in role to `KnowledgeVersioning` in
 * `@aos/knowledge-versioning` and `KnowledgeProvider` in `@aos/knowledge-provider`.
 * Wires Manager + StateMachine + Pipeline + Middleware + Resolver + Validator + Events.
 * Implements all 10 Policy Operations as metadata/lifecycle methods: validate -> drive
 * the State Machine to the target state via one atomic 8-stage Pipeline call -> record
 * metadata -> update statistics -> publish the matching event -> return the updated
 * `KnowledgePolicyRecord`. "No business execution. No permission execution beyond a
 * metadata-driven grant check. Metadata only."
 */
export class KnowledgePolicy {
  readonly registry: KnowledgePolicyRegistry;
  readonly manager: KnowledgePolicyManager;
  readonly stateMachine: KnowledgePolicyStateMachine;
  readonly validator: KnowledgePolicyValidator;
  readonly pipeline: KnowledgePolicyPipeline;
  readonly middleware: KnowledgePolicyMiddleware;
  readonly resolver: KnowledgePolicyResolver;
  readonly events: KnowledgePolicyEvents;
  readonly metrics: KnowledgePolicyMetrics;
  readonly health: KnowledgePolicyHealth;
  readonly monitoring: KnowledgePolicyMonitoring;
  readonly statistics: KnowledgePolicyStatistics;
  readonly lifecycle: KnowledgePolicyLifecycle;
  readonly factory: KnowledgePolicyFactory;
  readonly permission: KnowledgePolicyPermission;
  readonly session: KnowledgePolicySession;

  constructor(publisher: IPublisher) {
    this.registry = new KnowledgePolicyRegistry();
    this.session = new KnowledgePolicySession();
    this.manager = new KnowledgePolicyManager(this.registry, this.session);
    this.stateMachine = new KnowledgePolicyStateMachine();
    this.metrics = new KnowledgePolicyMetrics();
    this.validator = new KnowledgePolicyValidator();
    this.pipeline = new KnowledgePolicyPipeline(this.validator, this.metrics);
    this.middleware = new KnowledgePolicyMiddleware();
    this.resolver = new KnowledgePolicyResolver(this.registry);
    this.events = new KnowledgePolicyEvents(publisher);
    this.health = new KnowledgePolicyHealth(this.registry);
    this.monitoring = new KnowledgePolicyMonitoring(this.metrics, this.registry);
    this.statistics = new KnowledgePolicyStatistics();
    this.lifecycle = new KnowledgePolicyLifecycle();
    this.factory = new KnowledgePolicyFactory();
    this.permission = new KnowledgePolicyPermission();
  }

  /** Registers a `policy.use(...)` Koa-style middleware onto the shared chain. */
  use(middleware: PolicyMiddleware): this {
    this.middleware.use(middleware);
    return this;
  }

  /* ---- Operation 1: CreatePolicy ---- */
  async createPolicy(input: CreatePolicyInput): Promise<KnowledgePolicyRecord> {
    const token = generateKnowledgePolicyToken();
    const context = input.context;
    this.assertPermission(context, input.metadata, "create_policy");

    const now = new Date().toISOString();
    const draft: KnowledgePolicyExecution = {
      instance: {
        id: generateId(),
        token,
        policyId: input.metadata.policyId,
        tenantId: input.metadata.tenantId,
        workspaceId: input.metadata.workspaceId,
        state: KnowledgePolicyState.DRAFT,
        createdAt: now,
        updatedAt: now,
      },
      context,
      metadata: input.metadata,
      configuration: input.configuration,
      rules: input.rules ? [...input.rules] : [],
      scopes: input.scopes ? [...input.scopes] : [],
      assignments: [],
      history: [],
      auditTrail: [],
      logs: [],
    };

    const pipelined = this.pipeline.run({
      execution: draft,
      operation: "create_policy",
      targetState: KnowledgePolicyState.CREATED,
    });
    await this.middleware.run(pipelined);

    const entry: PolicyRegistryEntry = {
      id: pipelined.metadata.policyId,
      token,
      metadata: pipelined.metadata,
      configuration: pipelined.configuration,
    };

    this.manager.register(token, pipelined, entry);
    this.metrics.recordPolicy();

    await this.events.publishPolicyEvent(KnowledgePolicyEventType.POLICY_CREATED, context);

    return new KnowledgePolicyRecord(pipelined);
  }

  /* ---- Operation 2: ValidatePolicy ---- */
  async validatePolicy(input: ValidatePolicyInput): Promise<KnowledgePolicyValidationResult> {
    const execution = this.requireExecution(input.token);
    const result = this.validator.validate({
      metadata: execution.metadata,
      context: execution.context,
      configuration: execution.configuration,
      ruleCount: execution.rules.length,
      assignmentCount: execution.assignments.length,
    });

    if (result.valid) {
      const transitioned = this.pipeline.run({
        execution,
        operation: "validate_policy",
        targetState: KnowledgePolicyState.VALIDATED,
      });
      await this.middleware.run(transitioned);
      this.manager.update(input.token, transitioned);
      await this.events.publishPolicyEvent(
        KnowledgePolicyEventType.POLICY_VALIDATED,
        execution.context,
      );
    }

    return result;
  }

  /* ---- Operation 3: ActivatePolicy ---- */
  async activatePolicy(input: ActivatePolicyInput): Promise<KnowledgePolicyRecord> {
    const execution = this.requireExecution(input.token);
    this.assertPermission(execution.context, execution.metadata, "activate_policy");

    const transitioned = await this.runPipeline(
      execution,
      "activate_policy",
      KnowledgePolicyState.ACTIVE,
      input.reason,
    );
    this.metrics.recordActivePolicy();
    this.statistics.recordActivated(transitioned.metadata.policyType);

    await this.events.publishPolicyEvent(
      KnowledgePolicyEventType.POLICY_ACTIVATED,
      execution.context,
    );

    return new KnowledgePolicyRecord(transitioned);
  }

  /* ---- Operation 4: SuspendPolicy ---- */
  async suspendPolicy(input: SuspendPolicyInput): Promise<KnowledgePolicyRecord> {
    const execution = this.requireExecution(input.token);
    this.assertPermission(execution.context, execution.metadata, "suspend_policy");

    const transitioned = await this.runPipeline(
      execution,
      "suspend_policy",
      KnowledgePolicyState.SUSPENDED,
      input.reason,
    );

    await this.events.publishPolicyEvent(
      KnowledgePolicyEventType.POLICY_SUSPENDED,
      execution.context,
    );

    return new KnowledgePolicyRecord(transitioned);
  }

  /* ---- Operation 5: ArchivePolicy ---- */
  async archivePolicy(input: ArchivePolicyInput): Promise<KnowledgePolicyRecord> {
    const execution = this.requireExecution(input.token);
    this.assertPermission(execution.context, execution.metadata, "archive_policy");

    const transitioned = await this.runPipeline(
      execution,
      "archive_policy",
      KnowledgePolicyState.ARCHIVED,
      input.reason,
    );
    this.metrics.recordArchive();
    await this.events.publishPolicyEvent(
      KnowledgePolicyEventType.POLICY_ARCHIVED,
      execution.context,
    );

    return new KnowledgePolicyRecord(transitioned);
  }

  /* ---- Operation 6: RestorePolicy ---- */
  async restorePolicy(input: RestorePolicyInput): Promise<KnowledgePolicyRecord> {
    const execution = this.requireExecution(input.token);
    this.assertPermission(execution.context, execution.metadata, "restore_policy");

    const transitioned = await this.runPipeline(
      execution,
      "restore_policy",
      KnowledgePolicyState.RESTORED,
      input.reason,
    );
    this.metrics.recordRestore();
    await this.events.publishPolicyEvent(
      KnowledgePolicyEventType.POLICY_RESTORED,
      execution.context,
    );

    return new KnowledgePolicyRecord(transitioned);
  }

  /* ---- Operation 7: DestroyPolicy ---- */
  async destroyPolicy(input: DestroyPolicyInput): Promise<KnowledgePolicyRecord> {
    const execution = this.requireExecution(input.token);
    this.assertPermission(execution.context, execution.metadata, "destroy_policy");

    const transitioned = await this.runPipeline(
      execution,
      "destroy_policy",
      KnowledgePolicyState.DESTROYED,
      input.reason,
    );

    await this.events.publishPolicyEvent(
      KnowledgePolicyEventType.POLICY_DESTROYED,
      execution.context,
    );

    return new KnowledgePolicyRecord(transitioned);
  }

  /* ---- Operation 8: AssignPolicy ---- */
  async assignPolicy(input: AssignPolicyInput): Promise<AssignPolicyResult> {
    const execution = this.requireExecution(input.token);
    this.assertPermission(execution.context, execution.metadata, "assign_policy");

    const assignment = this.factory.assignment.create({
      policyId: execution.metadata.policyId,
      targetType: input.targetType,
      targetId: input.targetId,
      priority: input.priority,
    });

    this.registry.register(KnowledgePolicyRegistryBucket.ASSIGNMENT, assignment);

    const updated: KnowledgePolicyExecution = {
      ...execution,
      assignments: [...execution.assignments, assignment],
    };

    const pipelined = await this.runPipeline(updated, "assign_policy");
    this.metrics.recordAssignment();
    await this.events.publishPolicyEvent(
      KnowledgePolicyEventType.POLICY_ASSIGNED,
      execution.context,
    );

    return { policy: new KnowledgePolicyRecord(pipelined), assignment };
  }

  /* ---- Operation 9: UnassignPolicy ---- */
  async unassignPolicy(input: UnassignPolicyInput): Promise<KnowledgePolicyRecord> {
    const execution = this.requireExecution(input.token);
    this.assertPermission(execution.context, execution.metadata, "unassign_policy");

    this.registry.remove(KnowledgePolicyRegistryBucket.ASSIGNMENT, input.assignmentId);

    const updated: KnowledgePolicyExecution = {
      ...execution,
      assignments: execution.assignments.filter((a) => a.id !== input.assignmentId),
    };

    const pipelined = await this.runPipeline(updated, "unassign_policy");
    await this.events.publishPolicyEvent(
      KnowledgePolicyEventType.POLICY_UNASSIGNED,
      execution.context,
    );

    return new KnowledgePolicyRecord(pipelined);
  }

  /* ---- Operation 10: EvaluatePolicy ---- */
  async evaluatePolicy(input: EvaluatePolicyInput): Promise<EvaluatePolicyResult> {
    const execution = this.requireExecution(input.token);

    const evaluation = {
      id: generateId(),
      policyId: execution.metadata.policyId,
      targetId: input.targetId,
      result: KnowledgePolicyEvaluationResult.PASS,
      violations: [] as { ruleId: string; reason: string }[],
      evaluatedAt: new Date().toISOString(),
      evaluatedBy: execution.context.tenantId,
      metadata: { ...input.metadata },
    };

    /* Evaluate each enabled rule */
    for (const rule of execution.rules) {
      if (!rule.enabled) {
        continue;
      }
      if (rule.ruleType === "deny") {
        evaluation.violations.push({
          ruleId: rule.id,
          reason: `Rule "${rule.name}" has ruleType "deny"`,
        });
        evaluation.result = KnowledgePolicyEvaluationResult.FAIL;
      }
    }

    this.registry.register(KnowledgePolicyRegistryBucket.EVALUATION, evaluation);
    this.metrics.recordEvaluation();

    await this.events.publishPolicyEvent(
      KnowledgePolicyEventType.POLICY_EVALUATED,
      execution.context,
    );

    return { policy: new KnowledgePolicyRecord(execution), evaluation };
  }

  get(token: string): KnowledgePolicyRecord | undefined {
    const execution = this.manager.get(token);
    return execution ? new KnowledgePolicyRecord(execution) : undefined;
  }

  require(token: string): KnowledgePolicyRecord {
    return new KnowledgePolicyRecord(this.requireExecution(token));
  }

  list(): readonly KnowledgePolicyRecord[] {
    return this.manager.list().map((execution) => new KnowledgePolicyRecord(execution));
  }

  count(): number {
    return this.manager.count();
  }

  /* ---- Private helpers ---- */

  /** Runs the 8-stage Pipeline, the Middleware chain, and persists the result via the Manager. */
  private async runPipeline(
    execution: KnowledgePolicyExecution,
    operation: string,
    targetState?: KnowledgePolicyState,
    reason?: string,
  ): Promise<KnowledgePolicyExecution> {
    const result = this.pipeline.run({ execution, operation, targetState, reason });
    await this.middleware.run(result);
    this.manager.update(execution.instance.token, result);
    return result;
  }

  private requireExecution(token: string): KnowledgePolicyExecution {
    const execution = this.manager.get(token);
    if (!execution) {
      throw new PolicyNotFoundException(`No Policy is registered for Token "${token}"`);
    }
    return execution;
  }

  private assertPermission(
    context: KnowledgePolicyContext,
    metadata: { readonly policyType: string },
    operation: string,
  ): void {
    if (!this.permission.check(context, metadata as never, operation)) {
      throw new PolicyPermissionDeniedException(
        `Permission denied for operation "${operation}" on Policy Type "${metadata.policyType}" in Tenant "${context.tenantId}"`,
      );
    }
  }
}
