import { evaluateKnowledgeGenerationPolicy } from "../domain/knowledge-generation-policy.js";
import type { KnowledgeGenerationState } from "../domain/knowledge-generation-state.js";
import type { KnowledgeGeneratorExecution } from "../domain/knowledge-generator-execution.js";
import { GenerationContextException } from "../errors/generation-context-exception.js";
import { GenerationPolicyException } from "../errors/generation-policy-exception.js";
import { GenerationPromptException } from "../errors/generation-prompt-exception.js";
import { GenerationProviderException } from "../errors/generation-provider-exception.js";
import { GenerationValidationException } from "../errors/generation-validation-exception.js";
import type { IKnowledgeGeneratorMetricsCollector } from "../metrics/i-knowledge-generator-metrics-collector.js";
import { KnowledgeGeneratorRegistryBucket } from "../registry/knowledge-generator-registry-bucket.js";
import type { KnowledgeGeneratorRegistry } from "../registry/knowledge-generator-registry.js";
import type { KnowledgeGeneratorResolver } from "../resolver/knowledge-generator-resolver.js";
import { KnowledgeGeneratorStateMachine } from "../state-machine/knowledge-generator-state-machine.js";
import { generateId } from "../utils/id.js";
import type { KnowledgeGeneratorValidator } from "../validator/knowledge-generator-validator.js";

export type ProviderAvailabilityCheck = (providerType: string) => boolean;

export interface RunGeneratorPipelineInput {
  readonly execution: KnowledgeGeneratorExecution;
  readonly operation: string;
  readonly targetState?: KnowledgeGenerationState;
  readonly reason?: string;
  /** Set by the Facade for `prepare`/`start` operations, where a resolved Provider is mandatory. */
  readonly requireProvider?: boolean;
}

/**
 * "PIPELINE: Implement EXACTLY 10 stages. 1 Validation 2 Context Resolution 3 Prompt
 * Resolution 4 Policy Resolution 5 Provider Resolution 6 Metadata 7 Metrics 8 Lifecycle
 * 9 Audit 10 Logging" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md) — runs all 10 stages,
 * in this fixed order, for one Generation Operation. A failed Stage 1 (Validation)
 * halts the pipeline and throws `GenerationValidationException`. A successful run
 * advances the State Machine (Stage 8, only when `targetState` is supplied and differs
 * from the current state) and stamps Metadata/Audit/Logging onto the returned
 * `KnowledgeGeneratorExecution`. This package NEVER invokes an
 * `IKnowledgeGenerationProvider` from inside the Pipeline — Stage 5 only resolves
 * *which* provider would handle the request, it never calls it.
 */
export class KnowledgeGeneratorPipeline {
  private readonly stateMachine = new KnowledgeGeneratorStateMachine();

  constructor(
    private readonly validator: KnowledgeGeneratorValidator,
    private readonly metrics: IKnowledgeGeneratorMetricsCollector,
    private readonly registry: KnowledgeGeneratorRegistry,
    private readonly resolver: KnowledgeGeneratorResolver,
    private readonly isProviderAvailable: ProviderAvailabilityCheck,
  ) {}

  run(input: RunGeneratorPipelineInput): KnowledgeGeneratorExecution {
    const { operation, targetState, reason, requireProvider = false } = input;
    let result = input.execution;
    const now = new Date().toISOString();

    /* Stage 2/3 pre-computation feeds Stage 1's Validation input. */
    const contextReference = result.request.contextReferenceId
      ? this.resolver.tryResolveContext(result.request.contextReferenceId)
      : undefined;
    const promptReference = result.request.promptReferenceId
      ? this.resolver.tryResolvePrompt(result.request.promptReferenceId)
      : undefined;
    const policy = result.request.policyId
      ? this.resolver.tryResolvePolicy(result.request.policyId)
      : undefined;
    const providerAvailable = this.isProviderAvailable(result.request.providerType);

    /* Stage 1 — Validation */
    const validationResult = this.validator.validate({
      generation: result.instance,
      metadata: result.metadata,
      request: result.request,
      context: result.context,
      currentState: result.instance.state,
      targetState,
      contextResolvable: result.request.contextReferenceId ? Boolean(contextReference) : undefined,
      contextReference,
      promptResolvable: result.request.promptReferenceId ? Boolean(promptReference) : undefined,
      promptReference,
      policy,
      /* Provider availability is only mandatory for operations that flag `requireProvider`
       * (Facade `prepare()`/`start()`) — earlier lifecycle operations (create/queue/cancel/
       * fail/...) must not be blocked by an as-yet-unregistered Provider. */
      providerAvailable: requireProvider ? providerAvailable : undefined,
      configuration: result.configuration,
    });
    this.metrics.recordValidation(validationResult.valid);
    if (!validationResult.valid) {
      throw new GenerationValidationException(
        `Generation "${result.metadata.generationId}" failed validation for operation "${operation}": ${validationResult.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    /* Stage 2 — Context Resolution: resolve/attach the declared Context Reference (metadata presence check only). */
    if (result.request.contextReferenceId) {
      const resolved = this.resolver.tryResolveContext(result.request.contextReferenceId);
      if (!resolved) {
        throw new GenerationContextException(
          `Context Reference "${result.request.contextReferenceId}" is not registered in the Context Registry`,
        );
      }
      result = { ...result, contextReference: resolved };
      this.metrics.recordContextUsage();
    }

    /* Stage 3 — Prompt Resolution: resolve/attach the declared Prompt Reference (never constructs prompt text). */
    if (result.request.promptReferenceId) {
      const resolved = this.resolver.tryResolvePrompt(result.request.promptReferenceId);
      if (!resolved) {
        throw new GenerationPromptException(
          `Prompt Reference "${result.request.promptReferenceId}" is not registered in the Prompt Registry`,
        );
      }
      result = { ...result, promptReference: resolved };
      this.metrics.recordPromptUsage();
    }

    /* Stage 4 — Policy Resolution: resolve the declared Policy and evaluate allow/deny. */
    if (result.request.policyId) {
      const resolvedPolicy = this.resolver.resolvePolicy(result.request.policyId);
      const evaluation = evaluateKnowledgeGenerationPolicy(resolvedPolicy, {
        assetType: result.request.assetType,
        mode: result.request.mode,
        providerType: result.request.providerType,
      });
      if (!evaluation.allowed) {
        throw new GenerationPolicyException(
          `Generation "${result.metadata.generationId}" denied by Policy "${resolvedPolicy.policyId}": ${evaluation.reasons.join("; ")}`,
        );
      }
      result = { ...result, policy: resolvedPolicy };
      this.metrics.recordPolicyUsage();
    }

    /* Stage 5 — Provider Resolution: resolve WHICH registered IKnowledgeGenerationProvider
     * would handle this Request. Never calls it. */
    if (!providerAvailable && requireProvider) {
      throw new GenerationProviderException(
        `No IKnowledgeGenerationProvider is registered for Provider Type "${result.request.providerType}"`,
      );
    }
    if (providerAvailable) {
      this.metrics.recordProviderUsage();
    }

    /* Stage 6 — Metadata: stamp/attach KnowledgeGenerationMetadata */
    result = {
      ...result,
      metadata: { ...result.metadata, updatedAt: now },
    };

    /* Stage 7 — Metrics */
    this.metrics.recordGeneration();

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
      generationId: result.metadata.generationId,
      tenantId: result.context.tenantId,
      operation,
      actor: result.request.requestedBy,
      fromState,
      toState: result.instance.state,
      reason,
      occurredAt: now,
    };
    this.registry.register(KnowledgeGeneratorRegistryBucket.AUDIT, auditEntry);
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
          message: `Pipeline completed operation "${operation}" for Generation "${result.metadata.generationId}"`,
          occurredAt: now,
        },
      ],
    };

    return result;
  }
}
