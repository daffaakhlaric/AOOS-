# @aos/knowledge-synchronization

The AOS Enterprise Knowledge Synchronization Engine — the vendor-neutral synchronization
orchestrator bridging the Enterprise Knowledge Platform to external knowledge sources.
**Every external knowledge source synchronizes through this package. No source-specific
logic inside Knowledge Engine. No source-specific logic inside Runtime. Synchronization
must be completely provider-driven.** This package implements no OAuth, no API clients,
no Connector SDK, no LLM, no AI, no retrieval, no indexing, and no memory — those belong
to later roadmap phases. See `docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md` for the
explicit scope boundary and `docs/005.7E-KNOWLEDGE-SYNCHRONIZATION-REPORT.md` for the
readiness checklist handed to the next Knowledge Provider phase.

## Public API

`KnowledgeSynchronization`, `KnowledgeSynchronizationSystem`,
`KnowledgeSynchronizationManager`, `KnowledgeSynchronizationJob`,
`KnowledgeSynchronizationSession`, `KnowledgeSynchronizationContext`,
`KnowledgeSynchronizationRegistry`, `KnowledgeSynchronizationResolver`,
`KnowledgeSynchronizationPipeline`, `KnowledgeSynchronizationValidator`,
`KnowledgeSynchronizationScheduler`, `KnowledgeSynchronizationEvents`,
`KnowledgeSynchronizationMetrics`, `KnowledgeSynchronizationHealth`,
`KnowledgeSynchronizationMonitor`, `KnowledgeSynchronizationFactory`,
`KnowledgeSynchronizationStatistics`, `KnowledgeSynchronizationStateMachine`,
`KnowledgeSynchronizationLifecycle`, `KnowledgeSynchronizationPolicy` — the 20 names
required by the source prompt. `src/index.ts` also re-exports the Domain/Contracts/
Errors/Validator-stage/Factory-sub-class surface a caller needs to actually build and use
them.

## Quick example

```ts
import { KnowledgeEngine, KnowledgeEvents } from "@aos/knowledge-engine";
import { KnowledgeIndexEvents, KnowledgeIndexing } from "@aos/knowledge-indexing";
import { KnowledgeRetrieval, KnowledgeRetrievalEvents } from "@aos/knowledge-retrieval";
import {
  KnowledgeSynchronization,
  KnowledgeSynchronizationEvents,
  KnowledgeSynchronizationJobType,
  KnowledgeSynchronizationMode,
  KnowledgeSynchronizationProviderType,
  createKnowledgeSynchronizationContext,
} from "@aos/knowledge-synchronization";

const engine = new KnowledgeEngine({ events: new KnowledgeEvents(publisher) });
const indexing = new KnowledgeIndexing({ events: new KnowledgeIndexEvents(publisher) });
const retrieval = new KnowledgeRetrieval({
  knowledgeEngine: engine,
  knowledgeIndexing: indexing,
  events: new KnowledgeRetrievalEvents(publisher),
});
const synchronization = new KnowledgeSynchronization({
  knowledgeEngine: engine,
  knowledgeIndexing: indexing,
  knowledgeRetrieval: retrieval,
  events: new KnowledgeSynchronizationEvents(publisher),
});

// A caller registers at least one Provider — this package ships none.
synchronization.registerProvider({
  id: "my-provider",
  providerType: KnowledgeSynchronizationProviderType.DOCUMENT,
});

const job = synchronization.factory.job.create({
  type: KnowledgeSynchronizationJobType.MANUAL_SYNC,
  mode: KnowledgeSynchronizationMode.MANUAL,
  providerId: "my-provider",
  sourceId: "source-1",
  tenantId: "tenant-1",
});
const context = createKnowledgeSynchronizationContext({
  tenantId: "tenant-1",
  providerId: "my-provider",
  sourceId: "source-1",
  sourceType: KnowledgeSynchronizationProviderType.DOCUMENT,
});

const execution = await synchronization.synchronize(job, context);
// execution.changes — the Change Records this run detected and committed
```

## Architecture

```
@aos/knowledge-engine + @aos/knowledge-indexing + @aos/knowledge-retrieval
(read-only references — never written to)
        │
        ▼
KnowledgeSynchronization (synchronization/) — the public façade
        │
        ▼
KnowledgeSynchronizer (synchronizer/) — drives the State Machine around one Pipeline call
        │
        ▼
KnowledgeSynchronizationPipeline (pipeline/)
  Validation → Policy → Permission → Provider Resolution → Connection Validation →
  Change Detection → Synchronization → Commit → Metrics → Events
        │
        ▼
KnowledgeSynchronizationResolver — resolves Providers only, no provider implementation
        │
        ▼
KnowledgeSynchronizationPolicy — Policy evaluation + Conflict Resolution dispatch
        │
        ▼
KnowledgeSynchronizationManager
  ├── KnowledgeSynchronizationRegistry   (8 buckets)
  ├── KnowledgeSynchronizationSession    (Open/Resume/Close/Cancel/Expire/Renew)
  ├── KnowledgeSynchronizationStatistics (per-Mode counters)
  └── KnowledgeSynchronizationScheduler  (in-memory job ledger)
        │
        ▼
KnowledgeSynchronizationMiddlewarePipeline — sync.use() extensibility hook
        │
        ▼
contracts/ — 12 interface-only extension points, zero implementations
```

`KnowledgeSynchronization` is the composition root and this package's public façade —
constructed from a real `KnowledgeEngine` + `KnowledgeIndexing` + `KnowledgeRetrieval`
trio, held as read-only references never written to. `KnowledgeSynchronizer` is the
narrower "verb" class that actually runs one Pipeline invocation for one
`KnowledgeSynchronizationJob` and drives the Synchronization Lifecycle State Machine.

## Synchronization Lifecycle

13 states: Created, Queued, Preparing, Connecting, Synchronizing, Validating,
Committing, Completed, Failed, Cancelled, Retrying, Expired, Destroyed. Only `Destroyed`
is hard-terminal (no outgoing edges) — Completed/Failed/Cancelled/Expired are "settled"
but can still transition to Destroyed, unlike `@aos/knowledge-retrieval`'s all-4-terminal
model. `Failed` can transition to `Retrying`, which loops back to `Preparing`.

## Synchronization Flow

A caller registers at least one `IKnowledgeSynchronizationProvider`, then calls
`synchronization.synchronize(job, context, conflictStrategy?)`:

1. `KnowledgeSynchronizer` creates a `KnowledgeSynchronizationExecution` in the
   `Created` state, registers it, and publishes `knowledge.sync.created`.
2. It transitions to `Queued` and publishes `knowledge.sync.started`, then calls
   `KnowledgeSynchronizationPipeline.run()` — one atomic call covering all 10 stages.
3. On success, it rapidly transitions `Preparing` → `Connecting` → `Synchronizing` →
   `Validating` → `Committing` → `Completed`, stamps `changes`/`changeCount`, and
   publishes `knowledge.sync.completed`.
4. On failure, it transitions to `Failed`, publishes `knowledge.sync.failed`, and — if an
   optional `IKnowledgeSynchronizationRetryStrategy` says so — also transitions to
   `Retrying` and publishes `knowledge.sync.retry`. `synchronization.retry(token)`
   re-runs the Pipeline from `Retrying`.

`synchronization.cancel(token)`/`destroy(token)` transition to `Cancelled`/`Destroyed`
respectively; `destroy()` also removes the Execution from the Manager's ledger.

## Pipeline

10 stages, in fixed order: Validation → Policy → Permission → Provider Resolution →
Connection Validation → Change Detection → Synchronization (Conflict Resolution) →
Commit → Metrics → Events. Lifecycle events (Started/Completed/Failed/Cancelled/Retry)
are published by the outer `KnowledgeSynchronizer`, which owns the State Machine
transitions they describe; the Pipeline itself publishes only the two stage-scoped events
it can fully attribute — `knowledge.sync.validation.failed` and
`knowledge.sync.provider.resolved`.

## Registry

One generic class covering all 8 buckets the source prompt requires (Synchronization
Job/Provider/Policy/Schedule/Session/Statistics/Health/Lifecycle).
`KnowledgeSynchronizationStatistics` owns its own private per-Mode map rather than the
`STATISTICS` bucket — that bucket is for callers registering their own externally
computed statistics providers.

## Scheduler

`KnowledgeSynchronizationScheduler` — "Support Cron, Interval, One Time, Manual Trigger,
Event Trigger (interface only)" — an in-memory job ledger tracking Schedule requests
through pending → triggered/cancelled, mirroring `@aos/knowledge-indexing`'s
`KnowledgeIndexScheduler`. Never performs the actual sync work itself; optionally
delegates the "when to fire" concern to an external `IKnowledgeSynchronizationScheduler`
backend.

## Policies & Conflict Resolution

`KnowledgeSynchronizationPolicy` evaluates every enabled, scope-matching registered
`KnowledgeSynchronizationPolicyRecord` against a Job's `mode` (allowedModes/deniedModes),
and separately dispatches Conflict Resolution — "Create interface-only contracts ... No
implementation." — to a registered `IKnowledgeSynchronizationConflictResolver`, owning no
resolution algorithm itself (mirrors `@aos/knowledge-retrieval`'s `KnowledgeRankingEngine`
dispatch-only pattern). Requesting no strategy is a no-op pass-through; requesting an
unregistered strategy throws `ConflictResolutionNotSupportedException`.

## Change Detection

12 change types (`KnowledgeChangeType`): Added, Updated, Deleted, Moved, Renamed,
Metadata/Permission/Policy/Relationship/Version/Template Changed, Content Hash Changed.
"Only metadata detection. No content parsing." `KnowledgeSynchronizationResolver`
delegates to an optional injected `IKnowledgeSynchronizationChangeDetector`, returning
`[]` when unconfigured.

## Middleware Pipeline

`KnowledgeSynchronizationMiddlewarePipeline` — a Koa-style chain a caller extends via
`synchronization.use(middleware)`, run after every `synchronize()` call once the real
Pipeline has already validated/gated/resolved the Execution. The 7 named built-in slots
(Validation/Permission/Policy/Tracing/Metrics/Lifecycle/Logging) are pass-through hook
points; this package registers no tracing/logging/telemetry behavior itself, only the
extensibility mechanism.

## Validator

12 stages, run in fixed order by `KnowledgeSynchronizationValidator`, aggregating every
issue without short-circuiting: Provider, Source, Namespace, Policy, Permission,
Schedule, Metadata, Relationship, Version, Tenant, Workspace, Execution Token.

## Provider Resolver

"Resolve providers only. No provider implementation." 9 Provider Types
(`KnowledgeSynchronizationProviderType`): Document, Storage, Repository, CMS, Database,
API, File System, Knowledge Service, Future Provider.

## Metrics

```
KnowledgeSynchronizationMetrics
├── synchronizationCount / successfulSynchronizations / failedSynchronizations
├── retryCount / averageDurationMs
├── queueLength / pendingJobs
├── providerStatistics / workspaceStatistics / tenantStatistics
└── synchronizationModeStatistics
```

## Health

5 statuses (Healthy/Warning/Degraded/Unavailable/Unknown).
`KnowledgeSynchronizationHealth.check()` derives Registry health from whether anything is
registered across all 8 buckets, and Synchronization health from the live
`failedSynchronizations/synchronizationCount` ratio.

## Monitoring

`KnowledgeSynchronizationMonitor.sample()` combines a Metrics snapshot and a Health report
into one `KnowledgeSynchronizationDashboard` carrying all 9 named sections (Synchronization/
Provider/Job/Queue/Failure/Retry/Performance/Workspace/Tenant).

## Folder Structure

| Folder             | Contents                                                                        |
| ------------------ | ------------------------------------------------------------------------------- |
| `domain/`          | Job/Change Record/Lifecycle State/History/Statistics types, 6 enums             |
| `contracts/`       | 12 interface-only extension points                                              |
| `errors/`          | `KnowledgeSynchronizationException` + 13 concrete subclasses                    |
| `context/`         | `KnowledgeSynchronizationContext`, `createKnowledgeSynchronizationContext()`    |
| `token/`           | `KnowledgeSynchronizationToken` (`stok_` prefix)                                |
| `session/`         | `KnowledgeSynchronizationSession` — Open/Resume/Close/Cancel/Expire/Renew       |
| `state-machine/`   | `KnowledgeSynchronizationStateMachine` — strict FSM                             |
| `lifecycle/`       | `KnowledgeSynchronizationLifecycle` — read-only Lifecycle introspection         |
| `registry/`        | `KnowledgeSynchronizationRegistry` (8 generic buckets)                          |
| `resolver/`        | `KnowledgeSynchronizationResolver` — Provider resolution + Change Detection     |
| `validator/`       | 12 validator stages + `KnowledgeSynchronizationValidator` aggregator            |
| `scheduler/`       | `KnowledgeSynchronizationScheduler` — in-memory job ledger                      |
| `policy/`          | `KnowledgeSynchronizationPolicy` — Policy evaluation + Conflict Resolution      |
| `permission/`      | `ISynchronizationPermissionChecker` — query-level permission gate               |
| `pipeline/`        | `KnowledgeSynchronizationPipeline` — 10-stage fixed sequence                    |
| `middleware/`      | `KnowledgeSynchronizationMiddlewarePipeline` — `sync.use()` chain               |
| `factory/`         | `KnowledgeSynchronizationFactory` + 5 sub-factories                             |
| `events/`          | `KnowledgeSynchronizationEvents`, `KnowledgeSynchronizationEventType` (10)      |
| `metrics/`         | `KnowledgeSynchronizationMetrics`                                               |
| `health/`          | `KnowledgeSynchronizationHealth`                                                |
| `monitoring/`      | `KnowledgeSynchronizationMonitor`                                               |
| `statistics/`      | `KnowledgeSynchronizationStatistics`                                            |
| `manager/`         | `KnowledgeSynchronizationManager` — Registry+Session+Statistics+Scheduler       |
| `synchronizer/`    | `KnowledgeSynchronizer` — drives the State Machine around one Pipeline call     |
| `synchronization/` | `KnowledgeSynchronization` — the public façade                                  |
| `bootstrap/`       | `KnowledgeSynchronizationSystem` — implements `@aos/runtime-kernel`'s `IModule` |
| `config/`          | `KnowledgeSynchronizationConfig`                                                |

## Event Bus namespace

`knowledge.sync.created`, `.started`, `.completed`, `.failed`, `.cancelled`, `.retry`,
`.validation.failed`, `.provider.resolved`, `.metrics.updated`, `.health.changed` — every
one published via the real `@aos/event-bus` `IPublisher`.

## Known Limitations

- **All 12 extension-point contracts have zero implementations** — by design.
- **`KnowledgeSynchronizationResolver` ships zero registered Providers** — a caller must
  register at least one Provider before `synchronize()` can resolve anything.
- **`knowledge.sync.metrics.updated`/`.health.changed` are declared but never
  published** — no scheduled Metrics/Health-diffing sampler exists in this package
  (matching the same documented gap in prior Knowledge packages).
- **`KnowledgeSynchronizationSession` is a separate access-window ledger from the
  Synchronization Lifecycle State Machine** — the two are not automatically kept in sync.
- **Real cron/interval computation is out of scope** — `KnowledgeSynchronizationScheduler`
  tracks Schedule requests as an opaque ledger entry; it never computes actual next-run
  times or fires anything on a wall clock.

## Dependency Rules

Allowed: `@aos/runtime-kernel`, `@aos/registry`, `@aos/event-bus`, `@aos/scheduler`,
`@aos/knowledge-engine`, `@aos/knowledge-runtime`, `@aos/knowledge-indexing`,
`@aos/knowledge-retrieval`. Forbidden: `@aos/connector-runtime`, OAuth/secret-manager
packages, `@aos/tool-runtime`, `@aos/memory`, `@aos/agent-runtime`, `@aos/ai-gateway`,
`@aos/experience-layer`. Only interface references.

## Persistence

None. `KnowledgeSynchronizationRegistry`/`KnowledgeSynchronizationSession`/
`KnowledgeSynchronizationScheduler`/`KnowledgeSynchronizationManager`'s execution ledger
are in-memory only.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.7E-KNOWLEDGE-SYNCHRONIZATION-REPORT.md` for coverage numbers, known
limitations, and the readiness checklist for the next Knowledge Provider phase — **not
implemented in this package**.
