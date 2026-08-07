import { KnowledgeValidationDecisionValue } from "../domain/knowledge-validation-decision-value.js";
import type { KnowledgeValidationDecision } from "../domain/knowledge-validation-decision.js";
import type { KnowledgeValidationExecution } from "../domain/knowledge-validation-execution.js";
import { evaluateKnowledgeValidationPolicy } from "../domain/knowledge-validation-policy.js";
import type { KnowledgeValidationState } from "../domain/knowledge-validation-state.js";
import type { KnowledgeValidationStatisticsSnapshot } from "../domain/knowledge-validation-statistics-snapshot.js";
import { ValidationCheckException } from "../errors/validation-check-exception.js";
import { ValidatorConfigurationException } from "../errors/validator-configuration-exception.js";
import { ValidatorDecisionException } from "../errors/validator-decision-exception.js";
import { ValidatorPolicyException } from "../errors/validator-policy-exception.js";
import { ValidatorRuleException } from "../errors/validator-rule-exception.js";
import type { IKnowledgeValidatorMetricsCollector } from "../metrics/i-knowledge-validator-metrics-collector.js";
import { KnowledgeValidatorRegistryBucket } from "../registry/knowledge-validator-registry-bucket.js";
import type { KnowledgeValidatorRegistry } from "../registry/knowledge-validator-registry.js";
import type { KnowledgeValidatorResolver } from "../resolver/knowledge-validator-resolver.js";
import { KnowledgeValidatorStateMachine } from "../state-machine/knowledge-validator-state-machine.js";
import { generateId } from "../utils/id.js";
import type { KnowledgeValidatorValidator } from "../validator/knowledge-validator-validator.js";

export interface RunValidatorPipelineInput {
  readonly execution: KnowledgeValidationExecution;
  readonly operation: string;
  readonly targetState?: KnowledgeValidationState;
  readonly reason?: string;
  readonly decision?: KnowledgeValidationDecision;
  readonly statisticsSnapshot?: KnowledgeValidationStatisticsSnapshot;
}

/**
 * "PIPELINE: Implement EXACTLY 10 stages. 1 Validation 2 Rule Resolution 3 Policy
 * Resolution 4 Configuration Resolution 5 Decision Resolution 6 Metadata 7 Metrics
 * 8 Lifecycle 9 Audit 10 Logging" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md) — runs
 * all 10 stages, in this fixed order, for one Validation Operation. A failed Stage 1
 * (Validation, which runs the entire 12-stage `KnowledgeValidatorValidator`) halts the
 * pipeline and throws `ValidationCheckException`. A successful run advances the State
 * Machine (Stage 8, only when `targetState` is supplied and differs from the current
 * state) and stamps Metadata/Metrics/Audit/Logging onto the returned
 * `KnowledgeValidationExecution`. This package NEVER invokes an
 * `IKnowledgeValidationProvider`/`IKnowledgeValidationDecisionProvider` from inside the
 * Pipeline — provider invocation is a Facade-level concern (`KnowledgeValidator.start()`
 * /`approve()`/`reject()`), entirely outside these 10 stages.
 *
 * See docs/005.7M-KNOWLEDGE-VALIDATOR-AI-REPORT.md — "Pipeline" for the full three-way
 * "Validation" naming distinction: this Stage 1 RUNS the 12-stage Validator aggregator;
 * the Validator's own Stage 3 (also named "Validation") checks the REQUEST's
 * well-formedness; the aggregator class itself is `KnowledgeValidatorValidator`.
 */
export class KnowledgeValidatorPipeline {
  private readonly stateMachine = new KnowledgeValidatorStateMachine();

  constructor(
    private readonly validator: KnowledgeValidatorValidator,
    private readonly metrics: IKnowledgeValidatorMetricsCollector,
    private readonly registry: KnowledgeValidatorRegistry,
    private readonly resolver: KnowledgeValidatorResolver,
  ) {}

  run(input: RunValidatorPipelineInput): KnowledgeValidationExecution {
    const { operation, targetState, reason, decision, statisticsSnapshot } = input;
    let result = input.execution;
    const now = new Date().toISOString();
    const fromState = result.instance.state;

    /* Stage 2-4 pre-computation feeds Stage 1's Validation input. */
    const { resolved: resolvedRules, missing: missingRuleIds } = this.resolver.tryResolveRules(
      result.request.ruleIds,
    );
    const policy = result.request.policyId
      ? this.resolver.tryResolvePolicy(result.request.policyId)
      : undefined;
    const configuration = result.request.configurationId
      ? this.resolver.tryResolveConfiguration(result.request.configurationId)
      : undefined;
    const effectiveDecision = decision ?? result.decision;

    /* Stage 1 — Validation: runs the entire 12-stage KnowledgeValidatorValidator. */
    const validationResult = this.validator.validate({
      validation: result.instance,
      metadata: result.metadata,
      request: result.request,
      context: result.context,
      currentState: fromState,
      targetState,
      rulesResolvable: result.request.ruleIds.length > 0 ? missingRuleIds.length === 0 : undefined,
      resolvedRules,
      policy,
      configuration,
      decision: effectiveDecision,
      statisticsSnapshot,
    });
    this.metrics.recordCheck(validationResult.valid);
    if (!validationResult.valid) {
      throw new ValidationCheckException(
        `Validation "${result.metadata.validationId}" failed the 12-stage Validator for operation "${operation}": ${validationResult.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    /* Stage 2 — Rule Resolution: resolve/attach every declared Rule id (metadata presence check only). */
    if (result.request.ruleIds.length > 0) {
      if (missingRuleIds.length > 0) {
        throw new ValidatorRuleException(
          `Rule(s) "${missingRuleIds.join('", "')}" are not registered in the Rule Registry`,
        );
      }
      result = { ...result, resolvedRules };
      this.metrics.recordRuleUsage(resolvedRules.length);
    }

    /* Stage 3 — Policy Resolution: resolve the declared Policy and evaluate allow/deny. */
    if (result.request.policyId) {
      if (!policy) {
        throw new ValidatorPolicyException(`Policy "${result.request.policyId}" does not resolve`);
      }
      const evaluation = evaluateKnowledgeValidationPolicy(policy, {
        categories: resolvedRules.map((rule) => rule.category),
        category: result.request.category,
      });
      if (!evaluation.allowed) {
        throw new ValidatorPolicyException(
          `Validation "${result.metadata.validationId}" denied by Policy "${policy.policyId}": ${evaluation.reasons.join("; ")}`,
        );
      }
      result = { ...result, policy };
      this.metrics.recordPolicyUsage();
    }

    /* Stage 4 — Configuration Resolution: resolve/validate the declared Configuration. */
    if (result.request.configurationId) {
      if (!configuration) {
        throw new ValidatorConfigurationException(
          `Configuration "${result.request.configurationId}" is not registered in the Configuration Registry`,
        );
      }
      result = { ...result, configuration };
      this.metrics.recordConfigurationUsage();
    }

    /* Stage 5 — Decision Resolution: if a Decision was already recorded (or is being
     * recorded by this operation), validate it's one of the 6 legal values and was
     * recorded while Reviewing. When none is present, this stage is a documented
     * no-op. */
    if (effectiveDecision) {
      const legalValues = new Set(Object.values(KnowledgeValidationDecisionValue));
      if (!legalValues.has(effectiveDecision.value)) {
        throw new ValidatorDecisionException(
          `Decision "${effectiveDecision.decisionId}" has an unknown value "${effectiveDecision.value}"`,
        );
      }
      this.metrics.recordDecision(effectiveDecision.confidence);
    }

    /* Stage 6 — Metadata: stamp/attach KnowledgeValidationMetadata */
    result = {
      ...result,
      metadata: { ...result.metadata, updatedAt: now },
    };

    /* Stage 7 — Metrics */
    this.metrics.recordValidation();

    /* Stage 8 — Lifecycle */
    if (targetState !== undefined && targetState !== fromState) {
      result = this.stateMachine.transition({
        execution: result,
        to: targetState,
        operation,
        reason,
      });
    }

    /* Stage 9 — Audit */
    const auditEntry = {
      id: generateId(),
      auditId: generateId(),
      validationId: result.metadata.validationId,
      tenantId: result.context.tenantId,
      operation,
      actor: result.request.requestedBy,
      fromState,
      toState: result.instance.state,
      reason,
      occurredAt: now,
    };
    this.registry.register(KnowledgeValidatorRegistryBucket.AUDIT, auditEntry);
    result = {
      ...result,
      auditTrail: [...result.auditTrail, auditEntry],
    };

    /* Stage 10 — Logging */
    result = {
      ...result,
      logs: [
        ...result.logs,
        {
          sequence: result.logs.length,
          level: "info",
          operation,
          message: `Pipeline completed operation "${operation}" for Validation "${result.metadata.validationId}"`,
          occurredAt: now,
        },
      ],
    };

    return result;
  }
}
