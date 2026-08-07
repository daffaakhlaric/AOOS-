import type { EmbeddingExecution } from "../domain/embedding-execution.js";
import { isModelCompatibleWithProvider } from "../domain/embedding-model-catalog.js";
import {
  buildModelRegistryId,
  buildProviderRegistryId,
} from "../domain/embedding-registry-keys.js";
import type { EmbeddingState } from "../domain/embedding-state.js";
import type { EmbeddingStatisticsSnapshot } from "../domain/embedding-statistics-snapshot.js";
import { EmbeddingCheckException } from "../errors/embedding-check-exception.js";
import { EmbeddingConfigurationException } from "../errors/embedding-configuration-exception.js";
import { EmbeddingModelException } from "../errors/embedding-model-exception.js";
import { EmbeddingNamespaceException } from "../errors/embedding-namespace-exception.js";
import { EmbeddingProviderException } from "../errors/embedding-provider-exception.js";
import type { IEmbeddingManagerMetricsCollector } from "../metrics/i-embedding-manager-metrics-collector.js";
import { EmbeddingRegistryBucket } from "../registry/embedding-registry-bucket.js";
import type { EmbeddingRegistry } from "../registry/embedding-registry.js";
import type { EmbeddingResolver } from "../resolver/embedding-resolver.js";
import { EmbeddingStateMachine } from "../state-machine/embedding-state-machine.js";
import { generateId } from "../utils/id.js";
import type { EmbeddingValidator } from "../validator/embedding-validator.js";

export interface RunEmbeddingPipelineInput {
  readonly execution: EmbeddingExecution;
  readonly operation: string;
  readonly targetState?: EmbeddingState;
  readonly reason?: string;
  readonly statisticsSnapshot?: EmbeddingStatisticsSnapshot;
}

/**
 * "PIPELINE: Implement EXACTLY 10 stages. 1 Validation 2 Provider Resolution 3 Model
 * Resolution 4 Namespace Resolution 5 Configuration Resolution 6 Metadata 7 Metrics
 * 8 Lifecycle 9 Audit 10 Logging" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md) — runs all
 * 10 stages, in this fixed order, for one Embedding Operation. A failed Stage 1
 * (Validation, which runs the entire 12-stage `EmbeddingValidator`) halts the pipeline
 * and throws `EmbeddingCheckException`. A successful run advances the State Machine
 * (Stage 8, only when `targetState` is supplied and differs from the current state) and
 * stamps Metadata/Metrics/Audit/Logging onto the returned `EmbeddingExecution`. This
 * package NEVER invokes an `IEmbeddingProvider` from inside the Pipeline — provider
 * invocation is a Facade-level concern (`EmbeddingManager.start()`), entirely outside
 * these 10 stages; Stages 2-3 only RESOLVE which registered Provider/Model would handle
 * the Request, they never call it.
 *
 * See docs/005.7N-EMBEDDING-MANAGER-REPORT.md — "Pipeline" for the Validator-stage vs
 * Pipeline-stage naming distinction: this Stage 1 RUNS the 12-stage `EmbeddingValidator`
 * aggregator; the Validator's own Stages 3-7 (also named Provider/Model/Namespace/
 * Configuration/Version) check the REQUEST's pre-flight field well-formedness, while
 * THIS Pipeline's Stages 2-5 perform the actual Registry lookups.
 */
export class EmbeddingPipeline {
  private readonly stateMachine = new EmbeddingStateMachine();

  constructor(
    private readonly validator: EmbeddingValidator,
    private readonly metrics: IEmbeddingManagerMetricsCollector,
    private readonly registry: EmbeddingRegistry,
    private readonly resolver: EmbeddingResolver,
  ) {}

  run(input: RunEmbeddingPipelineInput): EmbeddingExecution {
    const { operation, targetState, reason, statisticsSnapshot } = input;
    let result = input.execution;
    const now = new Date().toISOString();
    const fromState = result.instance.state;

    /* Stage 2-5 pre-computation feeds Stage 1's Validation input. */
    const providerRegistryId = buildProviderRegistryId(
      result.context.tenantId,
      result.request.providerType,
    );
    const resolvedProvider =
      this.resolver.tryResolveProvider(providerRegistryId) ?? result.resolvedProvider;
    const modelRegistryId = buildModelRegistryId(result.context.tenantId, result.request.modelName);
    const resolvedModel = this.resolver.tryResolveModel(modelRegistryId) ?? result.resolvedModel;
    const resolvedNamespace = result.request.namespaceId
      ? this.resolver.tryResolveNamespace(result.request.namespaceId)
      : result.resolvedNamespace;
    const configuration = result.request.configurationId
      ? this.resolver.tryResolveConfiguration(result.request.configurationId)
      : result.configuration;

    /* Stage 1 — Validation: runs the entire 12-stage EmbeddingValidator. */
    const validationResult = this.validator.validate({
      embedding: result.instance,
      metadata: result.metadata,
      request: result.request,
      context: result.context,
      currentState: fromState,
      targetState,
      resolvedProvider,
      resolvedModel,
      resolvedNamespace,
      configuration,
      statisticsSnapshot,
    });
    this.metrics.recordCheck(validationResult.valid);
    if (!validationResult.valid) {
      throw new EmbeddingCheckException(
        `Embedding "${result.metadata.embeddingId}" failed the 12-stage Validator for operation "${operation}": ${validationResult.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    /* Stage 2 — Provider Resolution: resolve which registered Provider handles this Request. Never calls it. */
    if (!resolvedProvider) {
      throw new EmbeddingProviderException(
        `No Provider is registered for Provider Type "${result.request.providerType}"`,
      );
    }
    if (!resolvedProvider.active) {
      throw new EmbeddingProviderException(
        `Provider "${resolvedProvider.providerId}" is not active`,
      );
    }
    result = { ...result, resolvedProvider };

    /* Stage 3 — Model Resolution: resolve the declared Model and cross-check it's compatible with the resolved Provider. */
    if (!resolvedModel) {
      throw new EmbeddingModelException(
        `No Model is registered for Model Name "${result.request.modelName}"`,
      );
    }
    if (!resolvedModel.active) {
      throw new EmbeddingModelException(`Model "${resolvedModel.modelId}" is not active`);
    }
    if (!isModelCompatibleWithProvider(resolvedModel.name, resolvedProvider.type)) {
      throw new EmbeddingModelException(
        `Model "${resolvedModel.name}" is not compatible with Provider "${resolvedProvider.type}"`,
      );
    }
    result = { ...result, resolvedModel };

    /* Stage 4 — Namespace Resolution */
    if (result.request.namespaceId) {
      if (!resolvedNamespace) {
        throw new EmbeddingNamespaceException(
          `Namespace "${result.request.namespaceId}" is not registered in the Namespace Registry`,
        );
      }
      result = { ...result, resolvedNamespace };
    }

    /* Stage 5 — Configuration Resolution */
    if (result.request.configurationId) {
      if (!configuration) {
        throw new EmbeddingConfigurationException(
          `Configuration "${result.request.configurationId}" is not registered`,
        );
      }
      result = { ...result, configuration };
    }

    /* Stage 6 — Metadata: stamp/attach EmbeddingMetadata */
    result = { ...result, metadata: { ...result.metadata, updatedAt: now } };

    /* Stage 7 — Metrics */
    this.metrics.recordEmbedding();
    this.metrics.recordProviderUsage(resolvedProvider.type);

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
    const auditId = generateId();
    const auditEntry = {
      id: auditId,
      auditId,
      embeddingId: result.metadata.embeddingId,
      tenantId: result.context.tenantId,
      action: operation,
      actor: result.request.requestedBy,
      details: reason,
      occurredAt: now,
    };
    this.registry.register(EmbeddingRegistryBucket.AUDIT, auditEntry);
    result = { ...result, auditTrail: [...result.auditTrail, auditEntry] };

    /* Stage 10 — Logging */
    result = {
      ...result,
      logs: [
        ...result.logs,
        {
          sequence: result.logs.length,
          level: "info",
          operation,
          message: `Pipeline completed operation "${operation}" for Embedding "${result.metadata.embeddingId}"`,
          occurredAt: now,
        },
      ],
    };

    return result;
  }
}
