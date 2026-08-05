# @aos/knowledge-retrieval

The AOS Enterprise Knowledge Retrieval Engine — the vendor-neutral retrieval orchestrator
every future Agent uses to retrieve enterprise knowledge. **Never query indexes directly.
Never query vector databases directly. Always use Knowledge Retrieval.** This package
implements no embedding generation, no vector database, no LLM, no AI reasoning, no
prompt engineering, no memory, no synchronization, no chunking, and no knowledge
indexing — those belong to `@aos/knowledge-indexing` and later phases. See
`docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md` for the explicit scope boundary and
`docs/005.7D-KNOWLEDGE-RETRIEVAL-REPORT.md` for the readiness checklist handed to the
next Enterprise Knowledge Synchronization phase.

## Public API

`KnowledgeRetrieval`, `KnowledgeRetrievalSystem`, `KnowledgeRetriever`, `KnowledgeQuery`,
`KnowledgeQueryContext`, `KnowledgeQuerySession`, `KnowledgeResolver`, `KnowledgeFilter`,
`KnowledgeSearchPipeline`, `KnowledgeSearchStrategy`, `KnowledgeRankingEngine`,
`KnowledgePermissionResolver`, `KnowledgePolicyResolver`, `KnowledgeSearchFactory`,
`KnowledgeRetrievalRegistry`, `KnowledgeRetrievalValidator`, `KnowledgeRetrievalMetrics`,
`KnowledgeRetrievalHealth`, `KnowledgeRetrievalMonitor`, `KnowledgeRetrievalEvents`,
`KnowledgeRetrievalStatistics` — the 21 names required by the source prompt. `src/index.ts`
also re-exports the Domain/Contracts/Errors/Strategy/Factory-sub-class/Validator-stage
surface a caller needs to actually build and use them.

## Quick example

```ts
import { KnowledgeEngine, KnowledgeEvents } from "@aos/knowledge-engine";
import { KnowledgeIndexEvents, KnowledgeIndexing } from "@aos/knowledge-indexing";
import {
  createKnowledgeQueryContext,
  KnowledgeQueryType,
  KnowledgeRetrieval,
  KnowledgeRetrievalEvents,
  KnowledgeSearchMode,
} from "@aos/knowledge-retrieval";

const engine = new KnowledgeEngine({ events: new KnowledgeEvents(publisher) });
const indexing = new KnowledgeIndexing({ events: new KnowledgeIndexEvents(publisher) });
const retrieval = new KnowledgeRetrieval({
  knowledgeEngine: engine,
  knowledgeIndexing: indexing,
  events: new KnowledgeRetrievalEvents(publisher),
});

// A caller registers at least one Search Strategy — this package ships none.
retrieval.registerSearchStrategy({
  id: "ignored",
  mode: KnowledgeSearchMode.KEYWORD,
  execute: async (query, context, resolver) => {
    /* look up KnowledgeIndexResolver entries via resolver, build KnowledgeResult[] */
    return [];
  },
});

const query = retrieval.factory.query.create({
  type: KnowledgeQueryType.KEYWORD,
  keywords: ["refund policy"],
  searchModes: [KnowledgeSearchMode.KEYWORD],
});
const context = createKnowledgeQueryContext({ tenantId: "tenant-1", workspaceId: "ws-1" });

const execution = await retrieval.search(query, context);
// execution.results — the paged, ranked, filtered, permission-checked KnowledgeResult[]
```

## Architecture

```
@aos/knowledge-engine + @aos/knowledge-indexing (read-only inputs)
        │
        ▼
KnowledgeResolver (resolver/) — thin read-only pass-through over both engines
        │
        ▼
KnowledgeRetrieval (retrieval/) — the public façade
        │
        ▼
KnowledgeRetriever (retriever/) — drives the State Machine around one Pipeline call,
                                   publishes events
        │
        ▼
KnowledgeSearchPipeline (pipeline/)
  Validation → Permission → Policy → Namespace → Search Strategy → Ranking →
  Filtering → Result Builder → Metrics
        │
        ▼
KnowledgeSearchStrategy / KnowledgeRankingEngine — dispatch-only, no algorithms
        │
        ▼
KnowledgeFilter → KnowledgePolicyResolver → KnowledgePermissionResolver
        │
        ▼
KnowledgeRetrievalManager
  ├── KnowledgeRetrievalRegistry   (7 buckets)
  ├── KnowledgeQuerySession        (Open/Resume/Close/Cancel/Expire/Renew)
  └── KnowledgeRetrievalStatistics (per-Search-Mode counters)
        │
        ▼
contracts/ — 12 interface-only extension points, zero implementations
```

`KnowledgeRetrieval` is the composition root and this package's public façade —
constructed from a real `KnowledgeEngine` + `KnowledgeIndexing` pair. `KnowledgeRetriever`
is the narrower "verb" class that actually runs one Pipeline invocation for one
`KnowledgeQuery` and drives the Retrieval Lifecycle State Machine, mirroring the same
façade/verb split used in `@aos/knowledge-indexing`'s `KnowledgeIndexing`/`KnowledgeIndexer`.

## Retrieval Lifecycle

10 states: Created, Validating, Resolving, Searching, Ranking, Filtering, Completed,
Failed, Cancelled, Expired. Completed/Failed/Cancelled/Expired are all terminal — unlike
prior Runtime packages, Retrieval has no post-completion "destroy" step. Because
`KnowledgeSearchPipeline.run()` is one atomic call rather than a stage-by-stage chain,
`KnowledgeRetriever` transitions Created→Validating before calling it, then rapidly
transitions Resolving→Searching→Ranking→Filtering→Completed once it returns successfully
(or straight to Failed on error).

## Query Object & Search Modes

13 Query types (`KnowledgeQueryType`): Support, Question, Keyword, Metadata,
Relationship, Namespace, Category, Tag, Hybrid, Template, Policy, Version, Collection.
19 Search Modes (`KnowledgeSearchMode`) drive which registered `IKnowledgeSearchStrategy`
provider(s) the Pipeline dispatches to per query.

## Pipeline

9 stages, in fixed order: Validation → Permission → Policy → Namespace → Search Strategy
→ Ranking → Filtering → Result Builder → Metrics. The early Permission/Policy stages are
a coarse-grained, permissive-by-default "may this Context run this Query at all" gate
(`IQueryPermissionChecker`/`IQueryPolicyChecker`). The real per-Result enforcement — "Never
expose unauthorized knowledge." — happens inside the Filtering stage via
`KnowledgePermissionResolver`/`KnowledgePolicyResolver`.

## Registry

One generic class covering all 7 buckets the source prompt requires (Search Strategy/
Ranking Strategy/Filter/Policy/Permission Provider/Result Builder/Search Provider).
`KnowledgeRetrievalStatistics` deliberately does **not** use the Registry — the source
prompt's own Registry list omits "Statistics" — so it owns its own private per-Search-Mode
map, the same judgment call `@aos/knowledge-engine`'s `KnowledgePermissionEngine` makes.

## Ranking

`KnowledgeRankingEngine` owns no ranking algorithm — "No algorithms. Only contracts." 7
named strategies (`KnowledgeRankingStrategy`: BM25/Hybrid/Semantic/Cross Encoder/Vector
Ranking/Rule Based/LLM Ranking) tag which registered `IKnowledgeRankingProvider` a caller
wants. Requesting no strategy is a documented no-op pass-through; requesting an
unregistered strategy throws `RankingNotSupportedException`.

## Permission Resolution

`KnowledgePermissionResolver` filters `KnowledgeResult[]` through an optional injected
`IResultPermissionChecker`, permissive by default when unconfigured — matching the
delegation pattern already used by `@aos/workflow-runtime`/`@aos/knowledge-runtime`'s
`PermissionMiddleware` and `@aos/knowledge-indexing`'s `IKnowledgeIndexChecker`.

## Policy Resolution

`KnowledgePolicyResolver` reuses `@aos/knowledge-engine`'s real `KnowledgePolicyEngine`
directly (no `ExecutionToken` needed by `evaluate()`), filtering out any Result whose
resolved Asset has one or more Policy violations. A Result whose Asset can no longer be
resolved passes through — there is nothing to evaluate a Policy against.

## Filtering

`KnowledgeFilter` applies the 13 structural fields of `KnowledgeFilterSet` (Workspace/
Department/Tenant/Classification/Language/Region/Category/Tags/Version/Template/Source/
Asset Type/Lifecycle) by resolving each Result's underlying `KnowledgeAsset` and comparing
real Asset fields. Permission/Policy are excluded here — that would duplicate
`KnowledgePermissionResolver`/`KnowledgePolicyResolver`'s own job.

## Metrics

```
KnowledgeRetrievalMetrics
├── totalQueries / successfulQueries / failedQueries
├── averageLatencyMs / averageRankingTimeMs / averageFilterTimeMs
├── permissionRejectCount / policyRejectCount
├── workspaceUsage / tenantUsage
└── searchModeStatistics
```

## Health

5 statuses (Healthy/Warning/Degraded/Unavailable/Unknown). `KnowledgeRetrievalHealth.check()`
derives Registry health from whether anything is registered across all 7 buckets, and
Query health from the live `failedQueries/totalQueries` ratio.

## Monitoring

`KnowledgeRetrievalMonitor.sample()` combines a Metrics snapshot and a Health report into
one `KnowledgeRetrievalDashboard` carrying all 7 named sections (Search/Ranking/Latency/
Workspace/Permission/Policy/Usage).

## Folder Structure

| Folder           | Contents                                                                   |
| ---------------- | -------------------------------------------------------------------------- |
| `domain/`        | Query/Result/Filter Set schemas, Retrieval State/History/Statistics types  |
| `contracts/`     | 12 interface-only extension points                                         |
| `errors/`        | `KnowledgeRetrievalException` + 11 concrete subclasses                     |
| `context/`       | `KnowledgeQueryContext`, `createKnowledgeQueryContext()`                   |
| `token/`         | `KnowledgeRetrievalToken` (`rtok_` prefix)                                 |
| `session/`       | `KnowledgeQuerySession` — Open/Resume/Close/Cancel/Expire/Renew            |
| `state-machine/` | `KnowledgeRetrievalStateMachine` — strict FSM                              |
| `registry/`      | `KnowledgeRetrievalRegistry` (7 generic buckets)                           |
| `resolver/`      | `KnowledgeResolver` — read-only pass-through over both engines             |
| `validator/`     | 5 validator stages + `KnowledgeRetrievalValidator` aggregator              |
| `strategy/`      | `KnowledgeSearchStrategy` dispatcher + 8 named Strategy interfaces         |
| `ranking/`       | `KnowledgeRankingEngine` — dispatch-only                                   |
| `permission/`    | `KnowledgePermissionResolver` — per-Result enforcement                     |
| `policy/`        | `KnowledgePolicyResolver` — reuses the real `KnowledgePolicyEngine`        |
| `filter/`        | `KnowledgeFilter` — 13 structural fields                                   |
| `pipeline/`      | `KnowledgeSearchPipeline` — 9-stage fixed sequence                         |
| `factory/`       | `KnowledgeSearchFactory` + 6 sub-factories                                 |
| `events/`        | `KnowledgeRetrievalEvents`, `KnowledgeRetrievalEventType` (8 values)       |
| `metrics/`       | `KnowledgeRetrievalMetrics`                                                |
| `health/`        | `KnowledgeRetrievalHealth`                                                 |
| `monitoring/`    | `KnowledgeRetrievalMonitor`                                                |
| `statistics/`    | `KnowledgeRetrievalStatistics`                                             |
| `manager/`       | `KnowledgeRetrievalManager` — Registry + Session + Statistics orchestrator |
| `retriever/`     | `KnowledgeRetriever` — drives the State Machine around one Pipeline call   |
| `retrieval/`     | `KnowledgeRetrieval` — the public façade                                   |
| `bootstrap/`     | `KnowledgeRetrievalSystem` — implements `@aos/runtime-kernel`'s `IModule`  |
| `config/`        | `KnowledgeRetrievalConfig`                                                 |

## Event Bus namespace

`knowledge.search.started`, `.completed`, `.failed`, `.filtered`, `.ranked`, `.cancelled`,
`.health.changed`, `.metrics.updated` — every one published via the real
`@aos/event-bus` `IPublisher`.

## Known Limitations

- **All 12 extension-point contracts have zero implementations** — by design.
- **`KnowledgeSearchStrategy`/`KnowledgeRankingEngine` ship zero registered providers** —
  a caller must register at least one Search Strategy before `search()` can return
  results.
- **`knowledge.search.health.changed`/`.metrics.updated` are declared but never
  published** — no scheduled Health/Metrics-diffing sampler exists in this package.
- **`KnowledgeQuerySession` is a separate access-window ledger from the Retrieval
  Lifecycle State Machine** — the two are not automatically kept in sync by this package.

## Dependency Rules

Allowed: `@aos/runtime-kernel`, `@aos/registry`, `@aos/event-bus`, `@aos/scheduler`,
`@aos/knowledge-engine`, `@aos/knowledge-runtime`, `@aos/knowledge-indexing`. Forbidden:
`@aos/memory`, `@aos/prompt-intelligence`, `@aos/capability-runtime`, `@aos/tool-runtime`,
`@aos/connector-runtime`, `@aos/ai-gateway`, `@aos/model-router`, `@aos/agent-runtime`,
`@aos/experience-layer`. Only interface references.

## Persistence

None. `KnowledgeRetrievalRegistry`/`KnowledgeQuerySession`/`KnowledgeRetrievalManager`'s
execution ledger are in-memory only.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.7D-KNOWLEDGE-RETRIEVAL-REPORT.md` for coverage numbers, known limitations, and
the readiness checklist for the next Enterprise Knowledge Synchronization phase — **not
implemented in this package**.
