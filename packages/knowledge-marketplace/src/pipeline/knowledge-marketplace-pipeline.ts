import type { KnowledgeMarketplaceExecution } from "../domain/knowledge-marketplace-execution.js";
import type { MarketplacePackageStatus } from "../domain/marketplace-package-status.js";
import { MarketplaceCompatibilityException } from "../errors/marketplace-compatibility-exception.js";
import { MarketplaceDependencyException } from "../errors/marketplace-dependency-exception.js";
import { MarketplaceValidationException } from "../errors/marketplace-validation-exception.js";
import type { IKnowledgeMarketplaceMetricsCollector } from "../metrics/i-knowledge-marketplace-metrics-collector.js";
import { KnowledgeMarketplaceRegistryBucket } from "../registry/knowledge-marketplace-registry-bucket.js";
import type { KnowledgeMarketplaceRegistry } from "../registry/knowledge-marketplace-registry.js";
import type { KnowledgeMarketplaceResolver } from "../resolver/knowledge-marketplace-resolver.js";
import { KnowledgeMarketplaceStateMachine } from "../state-machine/knowledge-marketplace-state-machine.js";
import { generateId } from "../utils/id.js";
import type { KnowledgeMarketplaceValidator } from "../validator/knowledge-marketplace-validator.js";

export interface RunMarketplacePipelineInput {
  readonly execution: KnowledgeMarketplaceExecution;
  readonly operation: string;
  readonly targetState?: MarketplacePackageStatus;
  readonly reason?: string;
}

/**
 * "PIPELINE: Exactly 9 stages. 1. Validation 2. Metadata Resolution 3. Dependency
 * Resolution 4. Compatibility Resolution 5. Category Resolution 6. Metrics
 * 7. Lifecycle 8. Audit 9. Logging" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md) — runs
 * all 9 stages, in this fixed order, for one Marketplace Operation. A failed Stage 1
 * (Validation) halts the pipeline and throws `MarketplaceValidationException`. A
 * successful run advances the State Machine (Stage 7, only when `targetState` is
 * supplied and differs from the current state) and stamps Audit/Logging metadata onto
 * the returned `KnowledgeMarketplaceExecution`.
 */
export class KnowledgeMarketplacePipeline {
  private readonly stateMachine = new KnowledgeMarketplaceStateMachine();

  constructor(
    private readonly validator: KnowledgeMarketplaceValidator,
    private readonly metrics: IKnowledgeMarketplaceMetricsCollector,
    private readonly registry: KnowledgeMarketplaceRegistry,
    private readonly resolver: KnowledgeMarketplaceResolver,
  ) {}

  run(input: RunMarketplacePipelineInput): KnowledgeMarketplaceExecution {
    const { operation, targetState, reason } = input;
    let result = input.execution;

    /* Stage 1 — Validation */
    const publisher = this.resolver.tryResolvePublisher(result.metadata.publisherId);
    const categoryResolvable = this.isCategoryResolvable(result.metadata.category);
    const knownPackageIds = this.registry
      .list<{ packageId: string }>(KnowledgeMarketplaceRegistryBucket.PACKAGE)
      .map((entry) => entry.packageId);

    const validationResult = this.validator.validate({
      metadata: result.metadata,
      context: result.context,
      package: result.package,
      currentState: result.instance.state,
      targetState,
      publisher,
      categoryResolvable,
      dependencies: result.dependencies,
      knownPackageIds,
      compatibility: result.compatibility,
      certification: result.certification,
    });
    this.metrics.recordValidation(validationResult.valid);
    if (!validationResult.valid) {
      throw new MarketplaceValidationException(
        `Listing "${result.metadata.listingId}" failed validation for operation "${operation}": ${validationResult.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    /* Stage 2 — Metadata Resolution: normalize/attach MarketplaceMetadata */
    const now = new Date().toISOString();
    result = {
      ...result,
      metadata: { ...result.metadata, updatedAt: now },
    };

    /* Stage 3 — Dependency Resolution: resolve every declared Dependency id against the
     * Registry's Dependency bucket (metadata presence check only — no version-solving). */
    for (const dependency of result.dependencies) {
      if (!this.registry.get(KnowledgeMarketplaceRegistryBucket.DEPENDENCY, dependency.id)) {
        throw new MarketplaceDependencyException(
          `Dependency "${dependency.id}" is not registered in the Dependency Registry`,
        );
      }
    }

    /* Stage 4 — Compatibility Resolution: compare against caller-supplied runtime/platform context (metadata comparison only) */
    if (result.compatibility) {
      const platform = result.context.metadata.platform;
      if (
        typeof platform === "string" &&
        result.compatibility.platformCompatibility.length > 0 &&
        !result.compatibility.platformCompatibility.includes(platform)
      ) {
        throw new MarketplaceCompatibilityException(
          `Listing "${result.metadata.listingId}" Compatibility does not declare Platform "${platform}"`,
        );
      }
      const runtime = result.context.metadata.runtime;
      if (
        typeof runtime === "string" &&
        result.compatibility.runtimeCompatibility.length > 0 &&
        !result.compatibility.runtimeCompatibility.includes(runtime)
      ) {
        throw new MarketplaceCompatibilityException(
          `Listing "${result.metadata.listingId}" Compatibility does not declare Runtime "${runtime}"`,
        );
      }
    }

    /* Stage 5 — Category Resolution: resolve/validate the declared Category against the Category Registry bucket */
    this.resolver.resolveCategory(result.metadata.category);

    /* Stage 6 — Metrics */
    this.metrics.recordPackage();

    /* Stage 7 — Lifecycle */
    const fromState = result.instance.state;
    if (targetState !== undefined && targetState !== fromState) {
      result = this.stateMachine.transition({
        execution: result,
        to: targetState,
        operation,
        reason,
      });
    }

    /* Stage 8 — Audit */
    result = {
      ...result,
      auditTrail: [
        ...result.auditTrail,
        {
          id: generateId(),
          operation,
          listingId: result.metadata.listingId,
          tenantId: result.context.tenantId,
          fromState,
          toState: result.instance.state,
          reason,
          occurredAt: now,
        },
      ],
    };

    /* Stage 9 — Logging */
    result = {
      ...result,
      logs: [
        ...result.logs,
        {
          sequence: result.logs.length,
          level: "info",
          operation,
          message: `Pipeline completed operation "${operation}" for Listing "${result.metadata.listingId}"`,
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

  private isCategoryResolvable(
    category: KnowledgeMarketplaceExecution["metadata"]["category"],
  ): boolean {
    try {
      this.resolver.resolveCategory(category);
      return true;
    } catch {
      return false;
    }
  }
}
