# @aos/knowledge-auto-update

Enterprise Knowledge Auto Update — the standalone, in-memory engine that detects, schedules,
validates, refreshes, synchronizes, and updates knowledge assets throughout the AOS Knowledge
Runtime.

This package owns the complete lifecycle of an automatic knowledge update: a deterministic
priority-queue-and-cron-model scheduler decides _when_ a job runs; a real 10-stage pipeline decides
_what happens_ when it runs (detect changes, analyze them, validate, resolve dependencies, resolve
conflicts, calculate priority, execute via a dispatched strategy, validate the result, generate a
report, publish events); and exponential backoff plus a configurable retry policy decide what
happens when a run fails. It is not responsible for retrieval, search, indexing, analytics, graph
management, or orchestration — those are sibling packages' concerns.

## Architecture

- **Domain Driven Design**: immutable entities with identity (`KnowledgeUpdateJob`,
  `KnowledgeUpdateTask`, `KnowledgeUpdateResult`, `KnowledgeUpdateSession`,
  `KnowledgeUpdateHistory`, `KnowledgeUpdateReport`, `KnowledgeUpdateSnapshot`), value objects
  (`KnowledgeUpdatePolicy`, `KnowledgeUpdateConfiguration`), services, a Strategy-pattern family, a
  Builder, factories, and an id-keyed registry.
- **Immutable domain models**: every entity and value object is frozen at construction. Nothing is
  ever mutated in place — every "update" (`job.withStatus(...)`, `policy.withRetry(...)`,
  `session.withTaskId(...)`) returns a new instance.
- **Standalone**: this package imports **zero** other `@aos/*` packages at runtime. It defines its
  own exception base (`KnowledgeAutoUpdateException`, mirroring `AosError`'s shape without
  extending it), its own lightweight event-publishing contract
  (`IKnowledgeAutoUpdateEventPublisher`, not `@aos/event-bus`), and its own minimal module contract
  (`IKnowledgeAutoUpdateModule`, structurally equivalent to but not importing
  `@aos/runtime-kernel`'s `IModule`). `dependencies` in `package.json` is empty; only build/test
  tooling packages appear in `devDependencies`.
- **Pure in-memory computation**: no database, no network, no filesystem persistence. Change
  detection compares caller-supplied metadata snapshots (`version`, `checksum`, `lastModifiedAt`) —
  this package never reads or writes real knowledge asset content.
- **Fully deterministic — no OS-dependent timers anywhere.** Every time-dependent computation
  (scheduling, staleness, backoff) depends on an injected `IClock` (`.now(): number`) rather than
  calling `Date.now()` directly. `SystemClock` (real wall-clock) is wired in only at the outermost
  composition boundary (`KnowledgeAutoUpdateEngine`'s default constructor argument); every test —
  and any caller who wants reproducible behavior — injects `ManualClock`, a hand-advanced fake with
  `.advance(ms)` / `.set(timestamp)`. The scheduler never calls `setTimeout`/`setInterval`; a caller
  (or a test) explicitly invokes `scheduler.processDue(now)` / `engine.tick(now)` to advance
  processing.
- **Event-driven**: 13 domain events (`UpdateStarted`, `UpdateCompleted`, `UpdateFailed`,
  `UpdateRetried`, `UpdateCancelled`, `UpdatePaused`, `UpdateResumed`, `UpdateScheduled`,
  `UpdateValidated`, `ConflictDetected`, `ConflictResolved`, `KnowledgeRefreshed`,
  `ReportGenerated`) published through `IKnowledgeAutoUpdateEventPublisher`, with an
  `InMemoryEventPublisher` default and a `NoOpEventPublisher` alternative.
- **Real algorithmic correctness, not orchestration theater.** A genuine binary-heap priority
  queue; a priority-aware generalization of Kahn's topological sort for combined
  dependency-and-priority scheduling; a correct, tested 5-field cron-subset parser/evaluator; exact
  exponential backoff; and a real semantic-version comparator all back the scheduling and
  conflict-resolution logic — see "Design Decisions" for what each does and how it was verified.

## Features

- **`KnowledgeAutoUpdateEngine`** — the top-level facade. Implements `IKnowledgeAutoUpdateModule`
  (`id` / `start()` / `stop()`) and exposes `scheduleJob`, `pauseJob`/`resumeJob`/`cancelJob`,
  `tick(now)`, `getMetrics()`, `getSnapshot()`, `expireStaleJobs(now)`, and policy management.
- **`KnowledgeUpdateScheduler`** — owns all scheduling state. Supports Immediate, Scheduled
  (one-shot at a fixed time), Interval (repeating), and Cron (5-field-subset repeating) job
  registration; pause/resume/cancel; and a single `processDue(now)` entry point that returns due
  job ids already ordered by combined dependency-and-priority rules.
- **`KnowledgeUpdatePipeline`** — the exact 10-stage flow from the specification (Detect Changes →
  Analyze Changes → Validate Update → Resolve Dependencies → Resolve Conflicts → Calculate Priority
  → Execute Update → Validate Result → Generate Report → Publish Events), run once per due job.
- **13 concrete `IKnowledgeUpdateStrategy` implementations** — one per `KnowledgeUpdateType`
  (Manual, Scheduled, Incremental, Full, Refresh, Synchronization, Version, Metadata, Policy,
  Dependency, Recovery, Retry, Emergency), resolved by `KnowledgeUpdateStrategyRegistry` and
  dispatched (never an if/else chain) from the pipeline's Execute Update stage.
- **`KnowledgeConflictResolver`** — two real Strategy-pattern conflict-resolution strategies,
  `LastWriteWins` and `VersionPriority`.
- **`KnowledgeUpdateMetrics`** — the 16 named metrics (Update/Success/Failure/Retry/Conflict Count,
  Average Update/Validation/Refresh Time, Pending/Completed/Cancelled/Expired Jobs, Queue Size,
  Success/Failure/Retry Rate) computed from accumulated statistics and current job counts.
- **`KnowledgeUpdateReportBuilder`** — a real fluent Builder assembling any of the 10 report types
  (Update Summary, Scheduler, Retry, Conflict, Refresh, Policy, Dependency, Validation, Statistics,
  Session Report) from caller-supplied data.

## Folder Structure

```
packages/knowledge-auto-update/
  src/
    contracts/      IClock, IKnowledgeAutoUpdateEventPublisher, IKnowledgeAutoUpdateModule
    entities/       KnowledgeUpdateJob/Task/Result/Session/History/Report/Snapshot
    value-objects/  KnowledgeUpdatePolicy (11 policy categories), KnowledgeUpdateConfiguration
    services/       KnowledgeAutoUpdateEngine (facade), Manager, Coordinator, Detector,
                     DecisionEngine, RefreshPlanner, ConflictResolver, VersionComparator,
                     StalenessAnalyzer, ChangeAnalyzer, DependencyAnalyzer, PriorityCalculator,
                     Validator, Metrics, Statistics
    scheduler/      KnowledgeUpdateScheduler (priority queue + cron model + pause/resume/cancel)
    pipeline/       KnowledgeUpdatePipeline + its 10 stage classes
    strategies/     IKnowledgeUpdateStrategy + 13 concrete strategies + registry,
                     KnowledgeRetryPolicy, KnowledgeBackoffStrategy
    registry/       KnowledgeUpdateRegistry (id-keyed jobs/tasks/results/sessions/reports/policies)
    builders/       KnowledgeUpdateReportBuilder
    factories/      real Factory-pattern classes for jobs/tasks/sessions/policies/results
    events/         event type enum + InMemoryEventPublisher + NoOpEventPublisher
    errors/         KnowledgeAutoUpdateException base + 16 concrete subclasses
    types/          shared TS types/enums (UpdateType, JobStatus, ScheduleDescriptor, ReportType, ...)
    utils/          clock, id-generator, cron parser, topological-sort, backoff, priority-queue, version
    index.ts        package barrel
  test/             mirrors src/, plus test/integration/ and test/helpers/ (.spec.ts, "test/" singular)
  README.md         this file
```

The Engineering Report lives at the **monorepo root**'s
`docs/005.7Q-KNOWLEDGE-AUTO-UPDATE-REPORT.md` — see "Design Decisions" below for why.

## Examples

### Scheduling and ticking an immediate job

```ts
import { KnowledgeAutoUpdateEngine, KnowledgeUpdateType } from "@aos/knowledge-auto-update";

const engine = new KnowledgeAutoUpdateEngine();

const job = engine.scheduleJob({
  targetId: "doc-123",
  updateType: KnowledgeUpdateType.Manual,
  payload: { title: "New title" },
});

engine.tick(); // processes all due jobs "now"
engine.getJob(job.id).status; // "completed"
engine.getMetrics().successRate; // 1
```

### Deterministic testing with a manual clock

```ts
import { KnowledgeAutoUpdateEngine, ManualClock, ScheduleKind } from "@aos/knowledge-auto-update";

const clock = new ManualClock(0);
const engine = new KnowledgeAutoUpdateEngine({ clock });

engine.scheduleJob({
  targetId: "doc-1",
  schedule: { kind: ScheduleKind.Interval, intervalMs: 3_600_000, startAt: 0 },
});

engine.tick(0); // first run
clock.advance(3_600_000);
engine.tick(clock.now()); // second run, one hour later — no real waiting involved
```

### Cron-style scheduling

```ts
import { ScheduleKind } from "@aos/knowledge-auto-update";

engine.scheduleJob({
  targetId: "doc-2",
  updateType: KnowledgeUpdateType.Refresh,
  schedule: { kind: ScheduleKind.Cron, expression: "0 9 * * 1-5" }, // 09:00 UTC, weekdays
});
```

### Retry with exponential backoff

```ts
const policy = engine.registerPolicy({
  name: "flaky-source",
  maxRetries: 3,
  retryDelayMs: 1000,
  backoffMultiplier: 2, // delays: 1000ms, 2000ms, 4000ms
});

engine.scheduleJob({ targetId: "doc-3", policyId: policy.id });
```

### Dependency-aware batches

```ts
const a = engine.scheduleJob({ targetId: "base-doc" });
const b = engine.scheduleJob({ targetId: "derived-doc", dependsOn: [a.id] });

engine.tick(); // scheduler orders a before b in the very same tick when both are due together
```

### Pause / resume / cancel

```ts
engine.pauseJob(job.id);
engine.resumeJob(job.id);
engine.cancelJob(job.id);
```

## Public API

The package barrel (`src/index.ts`) exports every public symbol, grouped by folder. The most
commonly used entry points are:

| Symbol                                                                                   | Kind           | Purpose                                                                   |
| ---------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------- |
| `KnowledgeAutoUpdateEngine`                                                              | class          | Top-level facade: owns manager, scheduler, coordinator, and pipeline      |
| `KnowledgeUpdateScheduler`                                                               | class          | Priority-queue-and-cron-model scheduling engine                           |
| `KnowledgeUpdatePipeline`                                                                | class          | The 10-stage orchestrator, usable standalone from the engine              |
| `KnowledgeUpdateCoordinator`                                                             | class          | Drives one scheduler tick's due jobs through the pipeline                 |
| `KnowledgeUpdateManager`                                                                 | class          | Job/task/session lifecycle CRUD over the registry                         |
| `KnowledgeUpdateRegistry`                                                                | class          | Id-keyed buckets for jobs/tasks/results/sessions/reports/policies         |
| `KnowledgeUpdateReportBuilder`                                                           | class          | Fluent Builder for any of the 10 report types                             |
| `KnowledgeUpdateStrategyRegistry`                                                        | class          | Resolves the `IKnowledgeUpdateStrategy` for a given `KnowledgeUpdateType` |
| `KnowledgeRetryPolicy` / `KnowledgeBackoffStrategy`                                      | class          | Retry-eligibility and exponential-backoff-delay computation               |
| `KnowledgeConflictResolver`                                                              | class          | `LastWriteWins` / `VersionPriority` conflict resolution                   |
| `KnowledgeVersionComparator`                                                             | class          | Real semantic-version comparison                                          |
| `KnowledgeStalenessAnalyzer`                                                             | class          | Threshold-based staleness computation                                     |
| `KnowledgeDependencyAnalyzer`                                                            | class          | Topological ordering + cycle detection over job batches                   |
| `KnowledgePriorityCalculator`                                                            | class          | Weighted-sum numeric priority scoring                                     |
| `KnowledgeUpdateMetrics`                                                                 | class          | Computes the 16 named metrics from raw counters                           |
| `KnowledgeUpdateJob` / `Task` / `Result` / `Session` / `History` / `Report` / `Snapshot` | entity         | Immutable domain aggregates                                               |
| `KnowledgeUpdatePolicy`                                                                  | value object   | The 11 policy categories composed into one immutable object               |
| `KnowledgeUpdateConfiguration`                                                           | value object   | Engine-level configuration                                                |
| `KnowledgeAutoUpdateException` (+16)                                                     | errors         | Local exception hierarchy                                                 |
| `KnowledgeAutoUpdateEventType`                                                           | enum           | The 13 domain event type strings                                          |
| `InMemoryEventPublisher` / `NoOpEventPublisher`                                          | class          | `IKnowledgeAutoUpdateEventPublisher` implementations                      |
| `IClock` / `SystemClock` / `ManualClock`                                                 | contract/class | The injectable-clock mechanism behind full determinism                    |
| `parseCronExpression` / `computeNextCronFireTime`                                        | function       | The cron-subset parser and next-fire-time calculator                      |
| `topologicalSort` / `priorityTopologicalSort`                                            | function       | Kahn's algorithm and its priority-aware generalization                    |
| `PriorityQueue`                                                                          | class          | Real binary-heap priority queue with FIFO tie-breaking                    |

## Design Decisions

1. **Folder-structure interpretation.** The spec's raw listing runs
   `src/{contracts,...,utils}` then `tests/` then `README.md` then
   `docs/005.7Q-KNOWLEDGE-AUTO-UPDATE-REPORT.md` all seemingly nested under `src/` — an informal
   listing, not literal nesting. This package follows the real convention every completed sibling
   uses: package root has `src/` (the 14 subfolders), a top-level `test/` folder (singular), a
   package-local `README.md`, and the Engineering Report at the **monorepo root**'s
   `docs/005.7Q-KNOWLEDGE-AUTO-UPDATE-REPORT.md`.
2. **Standalone architecture, same pattern as `knowledge-graph`/`knowledge-analytics`.** Own
   exception base, own event-publisher contract, own module contract — see "Architecture" above.
3. **Injectable `IClock`, not a bare function type.** Unlike `knowledge-analytics`'s
   `type Clock = () => number`, this package (the scheduling-and-retry-heavy package in the
   series) uses an interface `IClock { now(): number }` so the deterministic test double
   (`ManualClock`) can additionally expose `.advance(ms)` / `.set(timestamp)` as real methods
   without threading extra state through a closure. `SystemClock` and `ManualClock` both implement
   it; every service/stage takes an `IClock` via constructor/context injection.
4. **Cron-subset scope.** Standard 5-field `minute hour day-of-month month day-of-week` syntax with
   `*`, single values, lists (`a,b,c`), ranges (`a-b`), and steps (`*/n`, `a-b/n`). Day-of-month and
   day-of-week combine with OR semantics when both are restricted (matching standard cron), AND
   when only one is restricted. UTC only — no local-timezone/DST handling (see "Known
   Limitations"). `computeNextCronFireTime` searches minute-by-minute up to ~200,000 minutes
   (~139 days) ahead before giving up, keeping the algorithm bounded and provably terminating.
   Verified against a parameterized table of known expressions/timestamps/expected-next-fire-times
   including step values, lists, ranges, month/day-of-month/day-of-week rollovers, and the OR-vs-
   single-field-restricted distinction.
5. **Priority queue + dependency ordering unified via a priority-aware Kahn's algorithm.**
   `KnowledgeUpdateScheduler.processDue(now)` needs to satisfy both "dependency X must run before
   dependent Y" and "higher-priority jobs run first" for the _same_ due-jobs batch. Rather than
   sorting by priority and then separately re-ordering for dependencies (which can silently violate
   one constraint to satisfy the other), `utils/topological-sort.ts` exports
   `priorityTopologicalSort(nodes, edges, priorityOf)`: a generalization of Kahn's algorithm where
   the "ready set" (in-degree-zero nodes) is a real `PriorityQueue` instead of a FIFO queue. This
   guarantees dependency order is _never_ violated while, among nodes that are simultaneously
   ready, the highest-priority one is chosen first. Tie-breaking within equal priority is FIFO by
   original registration order. Tested directly (diamond graphs, chains, priority-vs-dependency
   conflicts) and through the scheduler's own `processDue` tests.
6. **Exponential backoff: `baseDelayMs * multiplier^attempt`, capped, no jitter by default.**
   `computeExponentialBackoffDelay` is a pure function; jitter is supported via an optional,
   caller-supplied pure function (never `Math.random()`) so behavior stays fully deterministic
   unless a host explicitly opts into (seeded) randomness. `KnowledgeBackoffStrategy` wraps this for
   policy-driven use; `KnowledgeRetryPolicy` combines it with `shouldRetry(attempt, maxRetries)`.
7. **Priority queue: binary min-heap with FIFO tie-breaking.** `PriorityQueue<T>` is a real
   array-backed binary heap (`O(log n)` enqueue/dequeue), not a sorted array. Ties in the supplied
   comparator are broken by insertion sequence number, giving deterministic, reproducible ordering
   for equal-priority items — verified against randomized and adversarial (all-equal-priority)
   input sets.
8. **Change detection operates on caller-supplied metadata snapshots only.**
   `KnowledgeUpdateDetector.detect(previous, current)` compares `version`/`checksum`/
   `lastModifiedAt`/`extra` fields the caller provides (typically read off the job's
   `payload`/`previousPayload`) — this package never inspects real asset content, matching its
   "detects... knowledge assets" mandate without owning storage or retrieval.
9. **Update-type-to-strategy mapping is 1:1 (13 strategies), sharing one template-method base
   class.** `BaseKnowledgeUpdateStrategy` handles the common success/failure result-shaping
   (`try { computeAppliedPayload() } catch { failure result }`); each concrete strategy implements
   only `computeAppliedPayload`, keeping every subclass to a few lines while remaining a real,
   independently-testable Strategy-pattern object (not an if/else branch in the pipeline).
   `VersionUpdateStrategy` is the one strategy with genuine business-rule failure modes (missing or
   non-newer version).
10. **Conflict resolution: exactly 2 real strategies.** `LastWriteWins` (latest `updatedAt` wins,
    first-registered wins ties) and `VersionPriority` (highest semantic version wins, requires every
    candidate to supply a version or throws `ConflictUnresolvedException`). A single implicit
    candidate (the job's own payload) never triggers `ConflictDetected`/`ConflictResolved` — those
    events only fire when the caller supplies 2+ genuinely competing candidates via
    `conflictCandidates` on the pipeline run input.
11. **`KnowledgeUpdateStatistics` (mutable counters) vs. `KnowledgeUpdateMetrics` (pure
    calculator), same split every completed sibling package uses.** `KnowledgeUpdateStatistics`
    accumulates raw counts/durations over the engine's lifetime; `KnowledgeUpdateMetrics.compute()`
    is a pure function turning a snapshot of those counters (plus current job-status counts and
    queue size) into the 16 named metrics — average/rate math is centralized and independently
    tested against known inputs (including the 0/0 → 0 rate convention, never `NaN`).
12. **10 reports, one flexible builder, not 10 classes.** `KnowledgeUpdateReportBuilder` is a
    fluent builder (`.ofType(type).withField(k, v).withData({...}).build(now)`) producing a single
    `KnowledgeUpdateReport` entity parameterized by `KnowledgeUpdateReportType`. The pipeline's
    Generate Report stage always builds an `UpdateSummary` per completed job; the other 9 types are
    intended for host/engine-level aggregation (metrics snapshots, scheduler state, etc.) using the
    same builder — this keeps the "10 report types" requirement genuinely satisfiable without
    inventing 10 near-identical classes with no independent behavior.
13. **Dependency resolution is per-job, checked against the registry, not a batch pre-pass.** The
    pipeline's Resolve Dependencies stage checks that every `job.dependsOn` id is registered and
    `Completed` (or `Cancelled`, treated as no-longer-blocking); if not, it throws
    `DependencyNotSatisfiedException`, which `KnowledgeUpdateCoordinator` catches specially (not
    treated as a job failure) and re-queues the job for a later tick without incrementing its
    retry-attempt counter. This composes correctly with the scheduler's own dependency-aware
    ordering: jobs due in the _same_ batch are already sequenced correctly by
    `priorityTopologicalSort`, so this per-job check only ever fires for cross-batch dependencies
    (a dependency job that is not yet due).
14. **`KnowledgeUpdateStatistics` durations are always `0`.** Every concrete strategy's execution is
    a synchronous, pure, in-memory transformation (never real I/O), so `durationMs` on every
    `KnowledgeUpdateResult` is genuinely `0` — this is documented, not a bug, and the averages the
    metrics compute reflect that honestly rather than fabricating fake elapsed time.

## Known Limitations

- **No real persistence.** Every job, task, result, session, report, and policy lives only in
  process memory and is lost on restart. A host that needs durability must persist these entities
  itself.
- **No cross-package data pulling.** Because the package is standalone, it cannot fetch real
  knowledge-asset content or metadata from `@aos/knowledge-graph`, `@aos/knowledge-retrieval`, etc.
  — every change-detection input must be pushed in by the caller.
- **Cron support is UTC-only, no DST/local-timezone semantics**, and `computeNextCronFireTime`
  gives up (throwing `InvalidCronExpressionException`) if no match is found within ~139 days —
  intentional for a package with no external timers and a documented, bounded search.
- **`durationMs` is always `0`** on every strategy execution result (see Design Decision 14) —
  `averageUpdateTimeMs`/`averageValidationTimeMs`/`averageRefreshTimeMs` will always read `0`
  unless a host wraps strategy execution with its own real timing and feeds it back through a
  custom strategy.
- **No built-in scheduling loop.** Nothing in this package calls `engine.tick()` on a timer —
  hosts must drive ticks themselves (on their own schedule, using their own real or virtual clock).
- **Rate-limiting and update-window policy fields are logical/advisory only** (per the spec's "Rate
  Limiting (logical only)"): `KnowledgeUpdatePolicy.rateLimiting` and `.updateWindow` are read by
  `isWithinUpdateWindow(hourUtc)` but nothing in the scheduler/coordinator currently enforces them
  automatically — a host wanting hard enforcement must check these fields itself before calling
  `scheduleJob`/`tick`.

## Extension Points

- **`IKnowledgeAutoUpdateEventPublisher`**: supply your own implementation to
  `KnowledgeAutoUpdateEngine`'s `eventPublisher` option to bridge events onward (e.g. to the real
  AOS event bus in a host application).
- **`IKnowledgeAutoUpdateModule`**: `KnowledgeAutoUpdateEngine` implements this `id`/`start`/`stop`
  shape so any host that duck-types against `@aos/runtime-kernel`'s `IModule` can integrate it
  without a compile-time dependency.
- **`IClock`**: supply any implementation (beyond `SystemClock`/`ManualClock`) to control time —
  useful for simulation, replay, or virtual-time test harnesses.
- **Custom pipeline stage lists**: `new KnowledgeUpdatePipeline(customStages)` accepts any array of
  `PipelineStage` objects, letting a host insert/replace/remove stages.
- **`new KnowledgeUpdateStrategyRegistry(customStrategies)`**: register a different set of
  `IKnowledgeUpdateStrategy` implementations (e.g. to change what "Full Update" means for a given
  deployment) without touching the pipeline.
- **`KnowledgeConflictResolver`**: constructed with an injectable `KnowledgeVersionComparator`;
  the Strategy pattern here is a natural extension point for adding a third resolution strategy.
- **`KnowledgeBackoffStrategy`'s jitter function**: pass any pure `(delayMs) => number` function to
  add deterministic jitter without breaking reproducibility.
