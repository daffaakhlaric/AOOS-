import type { KnowledgeQueryContext } from "../context/knowledge-query-context.js";
import type { KnowledgeQuery } from "../domain/knowledge-query.js";
import type { KnowledgeRankingStrategy } from "../domain/knowledge-ranking-strategy.js";
import type { KnowledgeResult } from "../domain/knowledge-result.js";
import { RetrievalPermissionDeniedException } from "../errors/retrieval-permission-denied-exception.js";
import { RetrievalPolicyViolationException } from "../errors/retrieval-policy-violation-exception.js";
import { RetrievalValidationException } from "../errors/retrieval-validation-exception.js";
import { KnowledgeFilter } from "../filter/knowledge-filter.js";
import type { IKnowledgeRetrievalMetrics } from "../metrics/i-knowledge-retrieval-metrics.js";
import type { IQueryPermissionChecker } from "../permission/i-query-permission-checker.js";
import type { IResultPermissionChecker } from "../permission/i-result-permission-checker.js";
import { KnowledgePermissionResolver } from "../permission/knowledge-permission-resolver.js";
import type { IQueryPolicyChecker } from "../policy/i-query-policy-checker.js";
import { KnowledgePolicyResolver } from "../policy/knowledge-policy-resolver.js";
import type { KnowledgeRankingEngine } from "../ranking/knowledge-ranking-engine.js";
import type { KnowledgeResolver } from "../resolver/knowledge-resolver.js";
import type { KnowledgeSearchStrategy } from "../strategy/knowledge-search-strategy.js";
import type { KnowledgeRetrievalValidator } from "../validator/knowledge-retrieval-validator.js";

export interface KnowledgeSearchPipelineOptions {
  readonly queryPermissionChecker?: IQueryPermissionChecker;
  readonly queryPolicyChecker?: IQueryPolicyChecker;
  readonly resultPermissionChecker?: IResultPermissionChecker;
}

export interface RunSearchInput {
  readonly query: KnowledgeQuery;
  readonly context: KnowledgeQueryContext;
  readonly rankingStrategy?: KnowledgeRankingStrategy;
}

export interface RunSearchOutput {
  readonly results: readonly KnowledgeResult[];
  readonly permissionRejectCount: number;
  readonly policyRejectCount: number;
}

/**
 * "RETRIEVAL PIPELINE: Query → Validation → Permission → Policy → Namespace → Search
 * Strategy → Ranking → Filtering → Result Builder → Metrics."
 * (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — runs all 9 stages, in this fixed order,
 * for one `KnowledgeQuery`. The early Permission/Policy stages are a coarse-grained
 * "may this Context run this Query at all" gate (`IQueryPermissionChecker`/
 * `IQueryPolicyChecker`, permissive by default); the real per-Result Permission/Policy
 * enforcement happens inside the Filtering stage via `KnowledgePermissionResolver`/
 * `KnowledgePolicyResolver` — "Permission filtering happens BEFORE results are
 * returned. Never expose unauthorized knowledge."
 */
export class KnowledgeSearchPipeline {
  private readonly filter: KnowledgeFilter;
  private readonly permissionResolver: KnowledgePermissionResolver;
  private readonly policyResolver: KnowledgePolicyResolver;

  constructor(
    private readonly validator: KnowledgeRetrievalValidator,
    private readonly searchStrategy: KnowledgeSearchStrategy,
    private readonly rankingEngine: KnowledgeRankingEngine,
    private readonly resolver: KnowledgeResolver,
    private readonly metrics: IKnowledgeRetrievalMetrics,
    private readonly options: KnowledgeSearchPipelineOptions = {},
  ) {
    this.filter = new KnowledgeFilter(resolver);
    this.permissionResolver = new KnowledgePermissionResolver(options.resultPermissionChecker);
    this.policyResolver = new KnowledgePolicyResolver(resolver.policy, resolver);
  }

  async run(input: RunSearchInput): Promise<RunSearchOutput> {
    const { query, context } = input;

    // 1. Validation
    const validation = this.validator.validate({ query, context });
    if (!validation.valid) {
      throw new RetrievalValidationException(
        `KnowledgeQuery "${query.id}" failed retrieval validation: ${validation.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    // 2. Permission (query-level gate)
    if (
      this.options.queryPermissionChecker &&
      !(await this.options.queryPermissionChecker.check(query, context))
    ) {
      throw new RetrievalPermissionDeniedException(
        `Permission denied for Query "${query.id}" in Context "${context.correlationId}"`,
      );
    }

    // 3. Policy (query-level gate)
    if (
      this.options.queryPolicyChecker &&
      !(await this.options.queryPolicyChecker.check(query, context))
    ) {
      throw new RetrievalPolicyViolationException(
        `Policy denied Query "${query.id}" in Context "${context.correlationId}"`,
      );
    }

    // 4. Namespace — annotate the Context with the resolved scope Search Strategies read.
    context.variables["namespaceScope"] = {
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
    };

    // 5. Search Strategy
    const rawResults = (
      await Promise.all(
        query.searchModes.map((mode) =>
          this.searchStrategy.execute(mode, query, context, this.resolver),
        ),
      )
    ).flat();
    for (const mode of query.searchModes) {
      this.metrics.recordSearchMode(mode);
    }

    // 6. Ranking
    const rankingStartedAt = performance.now();
    const ranked = await this.rankingEngine.rank(rawResults, query, context, input.rankingStrategy);
    this.metrics.recordRankingTime(performance.now() - rankingStartedAt);

    // 7. Filtering
    const filterStartedAt = performance.now();
    const structurallyFiltered = this.filter.apply(ranked, query.filters);
    const { allowed: policyAllowed, rejectedCount: policyRejectCount } =
      this.policyResolver.resolve(structurallyFiltered);
    const { allowed: permissionAllowed, rejectedCount: permissionRejectCount } =
      await this.permissionResolver.resolve(policyAllowed, context);
    this.metrics.recordFilterTime(performance.now() - filterStartedAt);
    this.metrics.recordPermissionReject(permissionRejectCount);
    this.metrics.recordPolicyReject(policyRejectCount);

    // 8. Result Builder — apply limit/offset.
    const paged = permissionAllowed.slice(query.offset, query.offset + query.limit);

    // 9. Metrics
    this.metrics.recordTenantUsage(context.tenantId);
    if (context.workspaceId) {
      this.metrics.recordWorkspaceUsage(context.workspaceId);
    }

    return { results: paged, permissionRejectCount, policyRejectCount };
  }
}
