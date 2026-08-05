import type { KnowledgeSynchronizationContext } from "../context/knowledge-synchronization-context.js";
import type { IKnowledgeSynchronizationCommitter } from "../contracts/i-knowledge-synchronization-committer.js";
import type { KnowledgeChangeRecord } from "../domain/knowledge-change-record.js";
import type { KnowledgeConflictResolutionStrategy } from "../domain/knowledge-conflict-resolution-strategy.js";
import type { KnowledgeSynchronizationJob } from "../domain/knowledge-synchronization-job.js";
import { ConnectionValidationException } from "../errors/connection-validation-exception.js";
import { SynchronizationPermissionDeniedException } from "../errors/synchronization-permission-denied-exception.js";
import { SynchronizationPolicyViolationException } from "../errors/synchronization-policy-violation-exception.js";
import { SynchronizationValidationException } from "../errors/synchronization-validation-exception.js";
import { KnowledgeSynchronizationEventType } from "../events/knowledge-synchronization-event-type.js";
import type { KnowledgeSynchronizationEvents } from "../events/knowledge-synchronization-events.js";
import type { IKnowledgeSynchronizationMetrics } from "../metrics/i-knowledge-synchronization-metrics.js";
import type { ISynchronizationPermissionChecker } from "../permission/i-synchronization-permission-checker.js";
import type { KnowledgeSynchronizationPolicy } from "../policy/knowledge-synchronization-policy.js";
import type { KnowledgeSynchronizationResolver } from "../resolver/knowledge-synchronization-resolver.js";
import type { KnowledgeSynchronizationValidator } from "../validator/knowledge-synchronization-validator.js";

export interface KnowledgeSynchronizationPipelineOptions {
  readonly permissionChecker?: ISynchronizationPermissionChecker;
  readonly committer?: IKnowledgeSynchronizationCommitter;
}

export interface RunSynchronizationInput {
  readonly job: KnowledgeSynchronizationJob;
  readonly context: KnowledgeSynchronizationContext;
  readonly conflictStrategy?: KnowledgeConflictResolutionStrategy;
}

export interface RunSynchronizationOutput {
  readonly changes: readonly KnowledgeChangeRecord[];
}

/**
 * "SYNCHRONIZATION PIPELINE: Validation → Policy → Permission → Provider Resolution →
 * Connection Validation → Change Detection → Synchronization → Commit → Metrics →
 * Events." (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) — runs all 10 stages, in
 * this fixed order, for one `KnowledgeSynchronizationJob`. Lifecycle events
 * (Started/Completed/Failed/Cancelled/Retry) are published by the outer
 * `KnowledgeSynchronizer` — which owns the State Machine transitions they describe,
 * mirroring `@aos/knowledge-retrieval`'s Pipeline/Retriever event-publishing split. This
 * Pipeline only publishes the two stage-scoped events it can fully attribute itself:
 * `VALIDATION_FAILED` and `PROVIDER_RESOLVED`.
 */
export class KnowledgeSynchronizationPipeline {
  constructor(
    private readonly validator: KnowledgeSynchronizationValidator,
    private readonly policy: KnowledgeSynchronizationPolicy,
    private readonly resolver: KnowledgeSynchronizationResolver,
    private readonly metrics: IKnowledgeSynchronizationMetrics,
    private readonly events: KnowledgeSynchronizationEvents,
    private readonly options: KnowledgeSynchronizationPipelineOptions = {},
  ) {}

  async run(input: RunSynchronizationInput): Promise<RunSynchronizationOutput> {
    const { job, context } = input;

    // 1. Validation
    const validation = this.validator.validate({ job, context });
    if (!validation.valid) {
      await this.events.publishSynchronizationEvent(
        KnowledgeSynchronizationEventType.VALIDATION_FAILED,
        context,
        { jobId: job.id, issues: validation.issues },
      );
      throw new SynchronizationValidationException(
        `KnowledgeSynchronizationJob "${job.id}" failed synchronization validation: ${validation.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    // 2. Policy
    const violations = this.policy.evaluate(job);
    if (violations.length > 0) {
      throw new SynchronizationPolicyViolationException(
        `Policy denied Job "${job.id}": ${violations.map((violation) => violation.reason).join("; ")}`,
      );
    }

    // 3. Permission
    if (
      this.options.permissionChecker &&
      !(await this.options.permissionChecker.check(job, context))
    ) {
      throw new SynchronizationPermissionDeniedException(
        `Permission denied for Job "${job.id}" in Context "${context.correlationId}"`,
      );
    }

    // 4. Provider Resolution
    const provider = this.resolver.resolveProvider(context.providerId);
    await this.events.publishSynchronizationEvent(
      KnowledgeSynchronizationEventType.PROVIDER_RESOLVED,
      context,
      { jobId: job.id, providerId: provider.id },
    );

    // 5. Connection Validation
    if (provider.validateConnection && !(await provider.validateConnection(context))) {
      throw new ConnectionValidationException(
        `Provider "${provider.id}" could not validate its connection to Source "${context.sourceId}"`,
      );
    }

    // 6. Change Detection
    const detectedChanges = await this.resolver.detectChanges(context);
    this.metrics.recordSynchronizationMode(job.mode);

    // 7. Synchronization (Conflict Resolution)
    const resolvedChanges = await this.policy.resolveConflicts(
      detectedChanges,
      input.conflictStrategy,
    );

    // 8. Commit
    if (this.options.committer) {
      await this.options.committer.commit({ job, context, changes: resolvedChanges });
    }

    // 9. Metrics
    this.metrics.recordProviderUsage(context.providerId);
    this.metrics.recordTenantUsage(context.tenantId);
    if (context.workspaceId) {
      this.metrics.recordWorkspaceUsage(context.workspaceId);
    }

    // 10. Events — lifecycle events (Started/Completed/Failed) are published by the
    // outer KnowledgeSynchronizer once it stamps the final Execution.
    return { changes: resolvedChanges };
  }
}
