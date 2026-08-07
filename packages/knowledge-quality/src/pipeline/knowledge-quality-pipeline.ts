import type { KnowledgeQualityAssessmentState } from "../domain/knowledge-quality-assessment-state.js";
import type { KnowledgeQualityAssessmentStatisticsSnapshot } from "../domain/knowledge-quality-assessment-statistics-snapshot.js";
import type { KnowledgeQualityExecution } from "../domain/knowledge-quality-execution.js";
import { evaluateKnowledgeQualityPolicy } from "../domain/knowledge-quality-policy.js";
import { AssessmentValidationException } from "../errors/assessment-validation-exception.js";
import { QualityConfigurationException } from "../errors/quality-configuration-exception.js";
import { QualityPolicyException } from "../errors/quality-policy-exception.js";
import { QualityProfileException } from "../errors/quality-profile-exception.js";
import { QualityRuleException } from "../errors/quality-rule-exception.js";
import type { IKnowledgeQualityMetricsCollector } from "../metrics/i-knowledge-quality-metrics-collector.js";
import { KnowledgeQualityRegistryBucket } from "../registry/knowledge-quality-registry-bucket.js";
import type { KnowledgeQualityRegistry } from "../registry/knowledge-quality-registry.js";
import type { KnowledgeQualityResolver } from "../resolver/knowledge-quality-resolver.js";
import { KnowledgeQualityStateMachine } from "../state-machine/knowledge-quality-state-machine.js";
import { generateId } from "../utils/id.js";
import type { KnowledgeQualityValidator } from "../validator/knowledge-quality-validator.js";

export interface RunQualityPipelineInput {
  readonly execution: KnowledgeQualityExecution;
  readonly operation: string;
  readonly targetState?: KnowledgeQualityAssessmentState;
  readonly reason?: string;
  readonly statisticsSnapshot?: KnowledgeQualityAssessmentStatisticsSnapshot;
}

/**
 * "PIPELINE: Implement EXACTLY 10 stages. 1 Validation 2 Rule Resolution 3 Profile
 * Resolution 4 Policy Resolution 5 Configuration Resolution 6 Metadata 7 Metrics
 * 8 Lifecycle 9 Audit 10 Logging" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md) — runs all
 * 10 stages, in this fixed order, for one Assessment Operation. A failed Stage 1
 * (Validation) halts the pipeline and throws `AssessmentValidationException`. A
 * successful run advances the State Machine (Stage 8, only when `targetState` is
 * supplied and differs from the current state) and stamps Metadata/Metrics/Audit/
 * Logging onto the returned `KnowledgeQualityExecution`. This package NEVER invokes an
 * `IKnowledgeQualityProvider`/`IKnowledgeQualityScoringProvider` from inside the
 * Pipeline — provider invocation is a Facade-level concern (`KnowledgeQuality.start()`),
 * entirely outside these 10 stages.
 */
export class KnowledgeQualityPipeline {
  private readonly stateMachine = new KnowledgeQualityStateMachine();

  constructor(
    private readonly validator: KnowledgeQualityValidator,
    private readonly metrics: IKnowledgeQualityMetricsCollector,
    private readonly registry: KnowledgeQualityRegistry,
    private readonly resolver: KnowledgeQualityResolver,
  ) {}

  run(input: RunQualityPipelineInput): KnowledgeQualityExecution {
    const { operation, targetState, reason, statisticsSnapshot } = input;
    let result = input.execution;
    const now = new Date().toISOString();

    /* Stage 2-5 pre-computation feeds Stage 1's Validation input. */
    const { resolved: resolvedRules, missing: missingRuleIds } = this.resolver.tryResolveRules(
      result.request.ruleIds,
    );
    const profile = result.request.profileId
      ? this.resolver.tryResolveProfile(result.request.profileId)
      : undefined;
    const policy = result.request.policyId
      ? this.resolver.tryResolvePolicy(result.request.policyId)
      : undefined;
    const configuration = result.request.configurationId
      ? this.resolver.tryResolveConfiguration(result.request.configurationId)
      : undefined;

    /* Stage 1 — Validation */
    const validationResult = this.validator.validate({
      assessment: result.instance,
      metadata: result.metadata,
      request: result.request,
      context: result.context,
      currentState: result.instance.state,
      targetState,
      rulesResolvable: result.request.ruleIds.length > 0 ? missingRuleIds.length === 0 : undefined,
      resolvedRules,
      profileResolvable: result.request.profileId ? Boolean(profile) : undefined,
      profile,
      policy,
      configuration,
      statisticsSnapshot,
    });
    this.metrics.recordValidation(validationResult.valid);
    if (!validationResult.valid) {
      throw new AssessmentValidationException(
        `Assessment "${result.metadata.assessmentId}" failed validation for operation "${operation}": ${validationResult.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    /* Stage 2 — Rule Resolution: resolve/attach every declared Rule id (metadata presence check only). */
    if (result.request.ruleIds.length > 0) {
      if (missingRuleIds.length > 0) {
        throw new QualityRuleException(
          `Rule(s) "${missingRuleIds.join('", "')}" are not registered in the Rule Registry`,
        );
      }
      result = { ...result, resolvedRules };
      this.metrics.recordRuleUsage(resolvedRules.length);
    }

    /* Stage 3 — Profile Resolution: resolve/attach the declared Profile. */
    if (result.request.profileId) {
      if (!profile) {
        throw new QualityProfileException(
          `Profile "${result.request.profileId}" is not registered in the Profile Registry`,
        );
      }
      result = { ...result, profile };
      this.metrics.recordProfileUsage();
    }

    /* Stage 4 — Policy Resolution: resolve the declared Policy and evaluate allow/deny. */
    if (result.request.policyId) {
      if (!policy) {
        throw new QualityPolicyException(`Policy "${result.request.policyId}" does not resolve`);
      }
      const evaluation = evaluateKnowledgeQualityPolicy(policy, {
        dimensions: resolvedRules.map((rule) => rule.dimension),
        mode: result.request.mode,
      });
      if (!evaluation.allowed) {
        throw new QualityPolicyException(
          `Assessment "${result.metadata.assessmentId}" denied by Policy "${policy.policyId}": ${evaluation.reasons.join("; ")}`,
        );
      }
      result = { ...result, policy };
      this.metrics.recordPolicyUsage();
    }

    /* Stage 5 — Configuration Resolution: resolve/validate the declared Configuration. */
    if (result.request.configurationId) {
      if (!configuration) {
        throw new QualityConfigurationException(
          `Configuration "${result.request.configurationId}" is not registered in the Configuration Registry`,
        );
      }
      result = { ...result, configuration };
      this.metrics.recordConfigurationUsage();
    }

    /* Stage 6 — Metadata: stamp/attach KnowledgeQualityAssessmentMetadata */
    result = {
      ...result,
      metadata: { ...result.metadata, updatedAt: now },
    };

    /* Stage 7 — Metrics */
    this.metrics.recordAssessment();

    /* Stage 8 — Lifecycle */
    const fromState = result.instance.state;
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
      assessmentId: result.metadata.assessmentId,
      tenantId: result.context.tenantId,
      operation,
      actor: result.request.requestedBy,
      fromState,
      toState: result.instance.state,
      reason,
      occurredAt: now,
    };
    this.registry.register(KnowledgeQualityRegistryBucket.AUDIT, auditEntry);
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
          message: `Pipeline completed operation "${operation}" for Assessment "${result.metadata.assessmentId}"`,
          occurredAt: now,
        },
      ],
    };

    return result;
  }
}
