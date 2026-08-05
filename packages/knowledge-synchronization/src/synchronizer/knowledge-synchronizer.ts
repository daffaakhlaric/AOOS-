import type { KnowledgeSynchronizationContext } from "../context/knowledge-synchronization-context.js";
import type { IKnowledgeSynchronizationRetryStrategy } from "../contracts/i-knowledge-synchronization-retry-strategy.js";
import type { KnowledgeConflictResolutionStrategy } from "../domain/knowledge-conflict-resolution-strategy.js";
import type { KnowledgeSynchronizationExecution } from "../domain/knowledge-synchronization-execution.js";
import type { KnowledgeSynchronizationInstance } from "../domain/knowledge-synchronization-instance.js";
import type { KnowledgeSynchronizationJob } from "../domain/knowledge-synchronization-job.js";
import { KnowledgeSynchronizationState } from "../domain/knowledge-synchronization-state.js";
import { KnowledgeSynchronizationEventType } from "../events/knowledge-synchronization-event-type.js";
import type { KnowledgeSynchronizationEvents } from "../events/knowledge-synchronization-events.js";
import type { KnowledgeSynchronizationManager } from "../manager/knowledge-synchronization-manager.js";
import type { IKnowledgeSynchronizationMetrics } from "../metrics/i-knowledge-synchronization-metrics.js";
import type { KnowledgeSynchronizationPipeline } from "../pipeline/knowledge-synchronization-pipeline.js";
import type { KnowledgeSynchronizationStateMachine } from "../state-machine/knowledge-synchronization-state-machine.js";
import { generateId } from "../utils/id.js";

export interface SynchronizeInput {
  readonly job: KnowledgeSynchronizationJob;
  readonly context: KnowledgeSynchronizationContext;
  readonly conflictStrategy?: KnowledgeConflictResolutionStrategy;
}

/**
 * "KnowledgeSynchronizer" — runs the `KnowledgeSynchronizationPipeline` for exactly one
 * `KnowledgeSynchronizationJob`, driving the `KnowledgeSynchronizationStateMachine`
 * through Created → Queued → Preparing → Connecting → Synchronizing → Validating →
 * Committing → Completed (or → Failed → Retrying), and publishing the matching
 * `KnowledgeSynchronizationEventType`. Since `KnowledgeSynchronizationPipeline.run()` is
 * one atomic call rather than a stage-by-stage driven chain, this class applies the 7
 * intermediate-state transitions in rapid in-process succession once the Pipeline call
 * returns successfully — mirroring `@aos/knowledge-retrieval`'s `KnowledgeRetriever`.
 */
export class KnowledgeSynchronizer {
  constructor(
    private readonly stateMachine: KnowledgeSynchronizationStateMachine,
    private readonly manager: KnowledgeSynchronizationManager,
    private readonly pipeline: KnowledgeSynchronizationPipeline,
    private readonly metrics: IKnowledgeSynchronizationMetrics,
    private readonly events: KnowledgeSynchronizationEvents,
    private readonly retryStrategy?: IKnowledgeSynchronizationRetryStrategy,
  ) {}

  async synchronize(input: SynchronizeInput): Promise<KnowledgeSynchronizationExecution> {
    const startedAt = performance.now();
    this.metrics.recordSynchronizationStarted();

    let execution = this.createExecution(input.job, input.context);
    this.manager.register(execution);
    await this.events.publishSynchronizationEvent(
      KnowledgeSynchronizationEventType.CREATED,
      input.context,
      {
        jobId: input.job.id,
      },
    );

    execution = this.stateMachine.transition({
      execution,
      to: KnowledgeSynchronizationState.QUEUED,
    });
    this.manager.update(execution);
    await this.events.publishSynchronizationEvent(
      KnowledgeSynchronizationEventType.STARTED,
      input.context,
      {
        jobId: input.job.id,
      },
    );

    try {
      const output = await this.pipeline.run({
        job: input.job,
        context: input.context,
        conflictStrategy: input.conflictStrategy,
      });

      for (const to of [
        KnowledgeSynchronizationState.PREPARING,
        KnowledgeSynchronizationState.CONNECTING,
        KnowledgeSynchronizationState.SYNCHRONIZING,
        KnowledgeSynchronizationState.VALIDATING,
        KnowledgeSynchronizationState.COMMITTING,
      ]) {
        execution = this.stateMachine.transition({ execution, to });
      }
      execution = this.stateMachine.transition({
        execution,
        to: KnowledgeSynchronizationState.COMPLETED,
      });
      execution = {
        ...execution,
        changes: output.changes,
        instance: {
          ...execution.instance,
          changeCount: output.changes.length,
          completedAt: new Date().toISOString(),
        },
      };
      this.manager.update(execution);
      this.manager.statistics.recordSynchronization(input.job.mode, output.changes.length);

      this.metrics.recordSynchronizationCompleted(performance.now() - startedAt);
      await this.events.publishSynchronizationEvent(
        KnowledgeSynchronizationEventType.COMPLETED,
        input.context,
        { jobId: input.job.id, changeCount: output.changes.length },
      );
      return execution;
    } catch (error) {
      execution = await this.handleFailure(execution, input.context, error);
      throw error;
    }
  }

  async retry(token: string): Promise<KnowledgeSynchronizationExecution> {
    let execution = this.manager.require(token);
    const startedAt = performance.now();
    execution = this.stateMachine.transition({
      execution,
      to: KnowledgeSynchronizationState.PREPARING,
      reason: "retry",
    });
    this.manager.update(execution);

    try {
      const output = await this.pipeline.run({ job: execution.job, context: execution.context });
      for (const to of [
        KnowledgeSynchronizationState.CONNECTING,
        KnowledgeSynchronizationState.SYNCHRONIZING,
        KnowledgeSynchronizationState.VALIDATING,
        KnowledgeSynchronizationState.COMMITTING,
      ]) {
        execution = this.stateMachine.transition({ execution, to });
      }
      execution = this.stateMachine.transition({
        execution,
        to: KnowledgeSynchronizationState.COMPLETED,
      });
      execution = {
        ...execution,
        changes: output.changes,
        instance: {
          ...execution.instance,
          changeCount: output.changes.length,
          completedAt: new Date().toISOString(),
        },
      };
      this.manager.update(execution);
      this.metrics.recordSynchronizationCompleted(performance.now() - startedAt);
      await this.events.publishSynchronizationEvent(
        KnowledgeSynchronizationEventType.COMPLETED,
        execution.context,
        { jobId: execution.job.id, changeCount: output.changes.length },
      );
      return execution;
    } catch (error) {
      execution = await this.handleFailure(execution, execution.context, error);
      throw error;
    }
  }

  async cancel(token: string): Promise<KnowledgeSynchronizationExecution> {
    const before = this.manager.require(token);
    const execution = this.stateMachine.transition({
      execution: before,
      to: KnowledgeSynchronizationState.CANCELLED,
    });
    this.manager.update(execution);
    await this.events.publishSynchronizationEvent(
      KnowledgeSynchronizationEventType.CANCELLED,
      execution.context,
      { jobId: execution.job.id },
    );
    return execution;
  }

  async destroy(token: string): Promise<KnowledgeSynchronizationExecution> {
    const before = this.manager.require(token);
    const execution = this.stateMachine.transition({
      execution: before,
      to: KnowledgeSynchronizationState.DESTROYED,
    });
    this.manager.update(execution);
    this.manager.unregister(token);
    return execution;
  }

  private async handleFailure(
    execution: KnowledgeSynchronizationExecution,
    context: KnowledgeSynchronizationContext,
    error: unknown,
  ): Promise<KnowledgeSynchronizationExecution> {
    let failed = this.stateMachine.transition({
      execution,
      to: KnowledgeSynchronizationState.FAILED,
      reason: error instanceof Error ? error.message : String(error),
    });
    this.manager.update(failed);
    this.metrics.recordSynchronizationFailed();
    await this.events.publishSynchronizationEvent(
      KnowledgeSynchronizationEventType.FAILED,
      context,
      {
        jobId: failed.job.id,
        error: error instanceof Error ? error.message : String(error),
      },
    );

    if (this.retryStrategy?.shouldRetry(failed, error)) {
      failed = this.stateMachine.transition({
        execution: failed,
        to: KnowledgeSynchronizationState.RETRYING,
      });
      failed = {
        ...failed,
        instance: { ...failed.instance, retryCount: failed.instance.retryCount + 1 },
      };
      this.manager.update(failed);
      this.metrics.recordRetry();
      await this.events.publishSynchronizationEvent(
        KnowledgeSynchronizationEventType.RETRY,
        context,
        {
          jobId: failed.job.id,
        },
      );
    }
    return failed;
  }

  private createExecution(
    job: KnowledgeSynchronizationJob,
    context: KnowledgeSynchronizationContext,
  ): KnowledgeSynchronizationExecution {
    const now = new Date().toISOString();
    const instance: KnowledgeSynchronizationInstance = {
      id: generateId(),
      token: context.token,
      jobId: job.id,
      providerId: job.providerId,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      state: KnowledgeSynchronizationState.CREATED,
      retryCount: 0,
      changeCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    return { instance, context, job, changes: [], history: [] };
  }
}
