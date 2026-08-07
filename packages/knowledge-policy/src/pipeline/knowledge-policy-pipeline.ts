import type { KnowledgePolicyExecution } from "../domain/knowledge-policy-execution.js";
import type { KnowledgePolicyState } from "../domain/knowledge-policy-state.js";
import { PolicyValidationException } from "../errors/policy-validation-exception.js";
import type { IKnowledgePolicyMetricsCollector } from "../metrics/i-knowledge-policy-metrics-collector.js";
import { KnowledgePolicyStateMachine } from "../state-machine/knowledge-policy-state-machine.js";
import { generateId } from "../utils/id.js";
import type { KnowledgePolicyValidator } from "../validator/knowledge-policy-validator.js";

export interface RunPolicyPipelineInput {
  readonly execution: KnowledgePolicyExecution;
  readonly operation: string;
  readonly targetState?: KnowledgePolicyState;
  readonly reason?: string;
}

/**
 * "PIPELINE: Exactly 8 stages. 1. Validation 2. Policy Resolution 3. Scope Resolution
 * 4. Assignment Resolution 5. Metrics 6. Lifecycle 7. Audit 8. Logging"
 * (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md) — runs all 8 stages, in this fixed order,
 * for one Policy Operation. A failed Stage 1 (Validation) halts the pipeline and throws
 * `PolicyValidationException` — matching the "validate -> drive the State Machine ->
 * record metadata" contract established by `@aos/knowledge-versioning`'s
 * `KnowledgeVersionPipeline`. A successful run advances the State Machine (Stage 6,
 * only when `targetState` is supplied and differs from the current state) and stamps
 * Audit/Logging metadata onto the returned `KnowledgePolicyExecution`.
 */
export class KnowledgePolicyPipeline {
  private readonly stateMachine = new KnowledgePolicyStateMachine();

  constructor(
    private readonly validator: KnowledgePolicyValidator,
    private readonly metrics: IKnowledgePolicyMetricsCollector,
  ) {}

  /** Runs all 8 stages in fixed order, returning the updated `KnowledgePolicyExecution`. */
  run(input: RunPolicyPipelineInput): KnowledgePolicyExecution {
    const { operation, targetState, reason } = input;
    let result = input.execution;

    /* Stage 1 — Validation */
    const validationResult = this.validator.validate({
      metadata: result.metadata,
      context: result.context,
      configuration: result.configuration,
      ruleCount: result.rules.length,
      assignmentCount: result.assignments.length,
      currentState: result.instance.state,
      targetState,
    });
    this.metrics.recordValidation(validationResult.valid);
    if (!validationResult.valid) {
      throw new PolicyValidationException(
        `Policy "${result.metadata.policyId}" failed validation for operation "${operation}": ${validationResult.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    /* Stage 2 — Policy Resolution (no-op: this package doesn't dereference policies) */

    /* Stage 3 — Scope Resolution (no-op: this package doesn't dereference scopes) */

    /* Stage 4 — Assignment Resolution (no-op: this package doesn't dereference assignments) */

    /* Stage 5 — Metrics */
    this.metrics.recordPolicy();

    /* Stage 6 — Lifecycle */
    const fromState = result.instance.state;
    if (targetState !== undefined && targetState !== fromState) {
      result = this.stateMachine.transition({
        execution: result,
        to: targetState,
        operation,
        reason,
      });
    }

    /* Stage 7 — Audit */
    const now = new Date().toISOString();
    result = {
      ...result,
      auditTrail: [
        ...result.auditTrail,
        {
          id: generateId(),
          operation,
          policyId: result.metadata.policyId,
          tenantId: result.context.tenantId,
          fromState,
          toState: result.instance.state,
          reason,
          occurredAt: now,
        },
      ],
    };

    /* Stage 8 — Logging */
    result = {
      ...result,
      logs: [
        ...result.logs,
        {
          sequence: result.logs.length,
          level: "info",
          operation,
          message: `Pipeline completed operation "${operation}" for Policy "${result.metadata.policyId}"`,
          occurredAt: now,
        },
      ],
    };

    /* Tracing (stamps trace if correlationId is present) */
    if (result.context.correlationId) {
      result = {
        ...result,
        trace: {
          traceId: result.context.traceId ?? generateId(),
          correlationId: result.context.correlationId,
          operation,
          tracedAt: now,
          runCount: (result.trace?.runCount ?? 0) + 1,
        },
      };
    }

    return result;
  }
}
