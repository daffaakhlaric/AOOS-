import type { KnowledgeVersionContext } from "../context/knowledge-version-context.js";
import type { KnowledgeBranch } from "../domain/knowledge-branch.js";
import type { KnowledgeVersionExecution } from "../domain/knowledge-version-execution.js";
import type { KnowledgeVersionState } from "../domain/knowledge-version-state.js";
import { VersionPermissionDeniedException } from "../errors/version-permission-denied-exception.js";
import { VersionPolicyViolationException } from "../errors/version-policy-violation-exception.js";
import { VersionValidationException } from "../errors/version-validation-exception.js";
import type { IKnowledgeVersionMetricsCollector } from "../metrics/i-knowledge-version-metrics-collector.js";
import type { KnowledgeVersionPermission } from "../permission/knowledge-version-permission.js";
import type { KnowledgeVersionPolicy } from "../policy/knowledge-version-policy.js";
import { KnowledgeVersionStateMachine } from "../state-machine/knowledge-version-state-machine.js";
import { generateId } from "../utils/id.js";
import type { KnowledgeVersionValidator } from "../validator/knowledge-version-validator.js";

export interface RunVersionPipelineInput {
  readonly execution: KnowledgeVersionExecution;
  readonly context: KnowledgeVersionContext;
  readonly operation: string;
  readonly targetState?: KnowledgeVersionState;
  readonly reason?: string;
  readonly branch?: KnowledgeBranch;
  readonly knownVersionIds?: readonly string[];
}

/**
 * "PIPELINE: Implement EXACTLY 8 stages. 1. Validation 2. Permission 3. Policy 4. Tracing
 * 5. Metrics 6. Lifecycle 7. Audit 8. Logging" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md)
 * — runs all 8 stages, in this fixed order, for one Version Operation. Any failure records
 * a Validation-Count metrics failure and publishes no event (the outer `KnowledgeVersioning`
 * façade owns the operation-specific Lifecycle events); a successful run advances the State
 * Machine (when `targetState` is supplied) and stamps Tracing/Audit/Logging metadata onto
 * the returned `KnowledgeVersionExecution`. Failure publishes no event of its own — the 11
 * named Events are all success-shaped Lifecycle events owned by the outer
 * `KnowledgeVersioning` façade; the Pipeline only records a failed Validation-Count sample.
 */
export class KnowledgeVersionPipeline {
  private readonly stateMachine = new KnowledgeVersionStateMachine();

  constructor(
    private readonly validator: KnowledgeVersionValidator,
    private readonly permission: KnowledgeVersionPermission,
    private readonly policy: KnowledgeVersionPolicy,
    private readonly metrics: IKnowledgeVersionMetricsCollector,
  ) {}

  async run(input: RunVersionPipelineInput): Promise<KnowledgeVersionExecution> {
    try {
      return await this.runStages(input);
    } catch (error) {
      this.metrics.recordValidation(false);
      throw error;
    }
  }

  private async runStages(input: RunVersionPipelineInput): Promise<KnowledgeVersionExecution> {
    const { context, operation, targetState, reason, branch, knownVersionIds } = input;
    let execution = input.execution;

    // 1. Validation
    const validation = this.validator.validate({
      metadata: execution.metadata,
      context,
      configuration: execution.configuration,
      currentState: execution.instance.state,
      targetState,
      branch,
      knownVersionIds,
    });
    if (!validation.valid) {
      throw new VersionValidationException(
        `Version "${execution.metadata.versionId}" failed validation for operation "${operation}": ${validation.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    // 2. Permission
    if (!this.permission.check(context, execution.metadata, operation)) {
      throw new VersionPermissionDeniedException(
        `Permission denied for operation "${operation}" on Version "${execution.metadata.versionId}"`,
      );
    }

    // 3. Policy
    const violations = this.policy.evaluate(execution.metadata, context);
    if (violations.length > 0) {
      throw new VersionPolicyViolationException(
        `Policy denied operation "${operation}" on Version "${execution.metadata.versionId}": ${violations
          .map((violation) => violation.reason)
          .join("; ")}`,
      );
    }

    // 4. Tracing
    const now = new Date().toISOString();
    const priorRunCount = execution.trace?.runCount ?? 0;
    execution = {
      ...execution,
      trace: {
        traceId: context.traceId ?? generateId(),
        correlationId: context.correlationId,
        operation,
        tracedAt: now,
        runCount: priorRunCount + 1,
      },
    };

    // 5. Metrics
    this.metrics.recordValidation(true);

    // 6. Lifecycle
    if (targetState !== undefined && targetState !== execution.instance.state) {
      execution = this.stateMachine.transition({ execution, to: targetState, operation, reason });
    }

    // 7. Audit
    execution = {
      ...execution,
      auditTrail: [
        ...execution.auditTrail,
        {
          id: generateId(),
          operation,
          versionId: execution.metadata.versionId,
          tenantId: context.tenantId,
          fromState: targetState !== undefined ? execution.history.at(-1)?.fromState : undefined,
          toState: targetState,
          reason,
          occurredAt: new Date().toISOString(),
        },
      ],
    };

    // 8. Logging
    execution = {
      ...execution,
      logs: [
        ...execution.logs,
        {
          sequence: execution.logs.length,
          level: "info",
          operation,
          message: `Version Pipeline completed operation "${operation}" for Version "${execution.metadata.versionId}"`,
          occurredAt: new Date().toISOString(),
        },
      ],
    };

    return execution;
  }
}
