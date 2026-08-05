import type { KnowledgeQueryContext } from "../context/knowledge-query-context.js";
import type { KnowledgeQuery } from "../domain/knowledge-query.js";
import type { KnowledgeRankingStrategy } from "../domain/knowledge-ranking-strategy.js";
import type { KnowledgeRetrievalExecution } from "../domain/knowledge-retrieval-execution.js";
import type { KnowledgeRetrievalInstance } from "../domain/knowledge-retrieval-instance.js";
import { KnowledgeRetrievalState } from "../domain/knowledge-retrieval-state.js";
import { KnowledgeRetrievalEventType } from "../events/knowledge-retrieval-event-type.js";
import type { KnowledgeRetrievalEvents } from "../events/knowledge-retrieval-events.js";
import type { KnowledgeRetrievalManager } from "../manager/knowledge-retrieval-manager.js";
import type { IKnowledgeRetrievalMetrics } from "../metrics/i-knowledge-retrieval-metrics.js";
import type { KnowledgeSearchPipeline } from "../pipeline/knowledge-search-pipeline.js";
import type { KnowledgeRetrievalStateMachine } from "../state-machine/knowledge-retrieval-state-machine.js";
import { generateId } from "../utils/id.js";

export interface RetrieveInput {
  readonly query: KnowledgeQuery;
  readonly context: KnowledgeQueryContext;
  readonly rankingStrategy?: KnowledgeRankingStrategy;
}

/**
 * "KnowledgeRetriever" (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md — "PUBLIC API") — runs
 * the `KnowledgeSearchPipeline` for exactly one `KnowledgeQuery`, driving the
 * `KnowledgeRetrievalStateMachine` through Created → Validating → Resolving → Searching →
 * Ranking → Filtering → Completed (or → Failed), and publishing the matching
 * `KnowledgeRetrievalEventType`.
 */
export class KnowledgeRetriever {
  constructor(
    private readonly stateMachine: KnowledgeRetrievalStateMachine,
    private readonly manager: KnowledgeRetrievalManager,
    private readonly pipeline: KnowledgeSearchPipeline,
    private readonly metrics: IKnowledgeRetrievalMetrics,
    private readonly events: KnowledgeRetrievalEvents,
  ) {}

  async retrieve(input: RetrieveInput): Promise<KnowledgeRetrievalExecution> {
    const startedAt = performance.now();
    this.metrics.recordQueryStarted();

    let execution = this.createExecution(input.query, input.context);
    this.manager.register(execution);
    await this.events.publishRetrievalEvent(
      KnowledgeRetrievalEventType.SEARCH_STARTED,
      input.context,
      {
        queryId: input.query.id,
      },
    );

    execution = this.stateMachine.transition({ execution, to: KnowledgeRetrievalState.VALIDATING });
    this.manager.update(execution);

    try {
      const output = await this.pipeline.run({
        query: input.query,
        context: input.context,
        rankingStrategy: input.rankingStrategy,
      });

      for (const to of [
        KnowledgeRetrievalState.RESOLVING,
        KnowledgeRetrievalState.SEARCHING,
        KnowledgeRetrievalState.RANKING,
        KnowledgeRetrievalState.FILTERING,
      ]) {
        execution = this.stateMachine.transition({ execution, to });
      }
      execution = this.stateMachine.transition({
        execution,
        to: KnowledgeRetrievalState.COMPLETED,
      });
      execution = {
        ...execution,
        results: output.results,
        instance: {
          ...execution.instance,
          resultCount: output.results.length,
          completedAt: new Date().toISOString(),
        },
      };
      this.manager.update(execution);

      this.metrics.recordQueryCompleted(performance.now() - startedAt);
      await this.events.publishRetrievalEvent(
        KnowledgeRetrievalEventType.SEARCH_RANKED,
        input.context,
        {
          queryId: input.query.id,
        },
      );
      await this.events.publishRetrievalEvent(
        KnowledgeRetrievalEventType.SEARCH_FILTERED,
        input.context,
        {
          queryId: input.query.id,
          permissionRejectCount: output.permissionRejectCount,
          policyRejectCount: output.policyRejectCount,
        },
      );
      await this.events.publishRetrievalEvent(
        KnowledgeRetrievalEventType.SEARCH_COMPLETED,
        input.context,
        {
          queryId: input.query.id,
          resultCount: output.results.length,
        },
      );
      return execution;
    } catch (error) {
      execution = this.stateMachine.transition({
        execution,
        to: KnowledgeRetrievalState.FAILED,
        reason: error instanceof Error ? error.message : String(error),
      });
      this.manager.update(execution);
      this.metrics.recordQueryFailed();
      await this.events.publishRetrievalEvent(
        KnowledgeRetrievalEventType.SEARCH_FAILED,
        input.context,
        {
          queryId: input.query.id,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }
  }

  async cancel(token: string): Promise<KnowledgeRetrievalExecution> {
    const before = this.manager.require(token);
    const execution = this.stateMachine.transition({
      execution: before,
      to: KnowledgeRetrievalState.CANCELLED,
    });
    this.manager.update(execution);
    await this.events.publishRetrievalEvent(
      KnowledgeRetrievalEventType.SEARCH_CANCELLED,
      execution.context,
      {
        queryId: execution.query.id,
      },
    );
    return execution;
  }

  private createExecution(
    query: KnowledgeQuery,
    context: KnowledgeQueryContext,
  ): KnowledgeRetrievalExecution {
    const now = new Date().toISOString();
    const instance: KnowledgeRetrievalInstance = {
      id: generateId(),
      token: context.token,
      queryId: query.id,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      state: KnowledgeRetrievalState.CREATED,
      resultCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    return { instance, context, query, results: [], history: [] };
  }
}
