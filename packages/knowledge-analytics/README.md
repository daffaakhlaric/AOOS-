# @aos/knowledge-analytics

Enterprise Knowledge Analytics — the standalone, in-memory analytics, metrics, and reporting
engine of the AOS Knowledge Runtime.

This package aggregates caller-supplied data points (searches, retrievals, queries, embeddings,
graph snapshots, quality checks, costs, and access counts) and computes real, correct derived
statistics — rates, averages, percentiles, and trends — via a shared metric calculator. It then
assembles the results into ten report types and point-in-time dashboard snapshots through a
six-stage analytics pipeline.

## Architecture

- **Domain Driven Design**: value objects (`KnowledgeMetricSample`,
  `KnowledgeAnalyticsConfiguration`, `KnowledgeMetricDefinition`), entities with identity
  (`KnowledgeAnalyticsReport`, `KnowledgeDashboardSnapshot`, `KnowledgeAnalyticsSummary`),
  services, factories, a builder, and registries.
- **Immutable domain models**: every value object and entity is frozen at construction. There are
  no mutating setters anywhere in the domain layer — "updates" either return a new instance
  (`KnowledgeAnalyticsConfiguration.with(...)`, `KnowledgeMetricSample.withTags(...)`) or are pure
  computations over recorded samples.
- **Standalone**: this package imports **zero** other `@aos/*` packages at runtime. It defines its
  own exception base (`KnowledgeAnalyticsException`, mirroring `AosError`'s shape without
  extending it), its own lightweight event-publishing contract
  (`IKnowledgeAnalyticsEventPublisher`, not `@aos/event-bus`), and its own minimal module contract
  (`IKnowledgeAnalyticsModule`, structurally equivalent to but not importing
  `@aos/runtime-kernel`'s `IModule`). `dependencies` in `package.json` is empty; only build/test
  tooling packages appear in `devDependencies`.
- **Pure in-memory computation**: no database, no network calls, no filesystem persistence. This
  package never reaches into `@aos/knowledge-graph`, `@aos/knowledge-retrieval`, or any other
  sibling package to pull real data — every analytics method accepts caller-supplied events
  (`recordSearch(event)`, `recordEmbedding(event)`, `recordGraphSnapshot(event)`, ...) and computes
  from what was recorded.
- **Event-driven**: 6 domain events (`AnalyticsStarted`, `AnalyticsCompleted`, `AnalyticsFailed`,
  `MetricCalculated`, `ReportGenerated`, `DashboardUpdated`) published through
  `IKnowledgeAnalyticsEventPublisher`, with an `InMemoryEventPublisher` default and a
  `NoOpEventPublisher` alternative.
- **Real statistical correctness**: percentiles use linear interpolation between closest ranks (the
  same method NumPy's default `percentile()` and Excel's `PERCENTILE.INC` use); rates guard
  against division by zero; trend analysis uses ordinary-least-squares linear regression plus
  period-over-period delta over time-bucketed history. See `src/utils/percentile.ts` and
  `src/utils/time-bucket.ts`.

## Features

- **11 domain-specific analytics services**, each owning a coherent slice of the 30 named metrics
  from the specification (see the distribution table below), all sharing one
  `KnowledgeMetricCalculator` for the actual math so no formula is reimplemented per service.
- **`KnowledgeMetricRegistry`**: an id-keyed registry (`Map`-based, `O(1)` lookups) of metric
  definitions and their most-recently-computed values.
- **`KnowledgeAnalyticsReportBuilder`**: a real Builder-pattern class (`.withUsage(...)`,
  `.withGraph(...)`, ..., `.build(type, options)`) assembling any of the 10 report types from
  whatever section content is supplied.
- **`KnowledgeAnalyticsPipeline`**: the exact 6-stage flow from the specification — Collect Metrics
  → Aggregate Metrics → Calculate KPIs → Generate Reports → Generate Dashboard Snapshot → Publish
  Events — as real sequential stage objects, each doing genuine work.
- **`KnowledgeAnalyticsEngine`**: the top-level facade composing all of the above, implementing
  `IKnowledgeAnalyticsModule` (`id` / `start()` / `stop()`) for host integration.
- **`KnowledgeAnalyticsStatistics`**: this package's own operational bookkeeping counters (samples
  recorded, metrics calculated, reports generated, pipeline runs completed/failed, events
  published) — distinct from the domain `Metrics` the analytics services compute.

## Folder Structure

```
packages/knowledge-analytics/
  src/
    contracts/     interface-only extension points (event publisher, module, external metrics sink)
    entities/       KnowledgeAnalyticsSummary (operational rollup entity)
    value-objects/  KnowledgeMetricSample, KnowledgeMetricDefinition, KnowledgeAnalyticsConfiguration
    analytics/      the 11 domain-specific analytics services + their shared base class
    metrics/        KnowledgeMetricCalculator (shared math), KnowledgeMetricRegistry
    reports/        KnowledgeAnalyticsReport, KnowledgeDashboardSnapshot (report-aggregate entities)
    builders/       KnowledgeAnalyticsReportBuilder
    factories/      real Factory-pattern classes for samples, snapshots, reports, configuration
    registry/       KnowledgeReportRegistry
    events/         event type enum + InMemoryEventPublisher + NoOpEventPublisher
    errors/         KnowledgeAnalyticsException base + 5 concrete subclasses
    pipeline/       KnowledgeAnalyticsPipeline + its 6 stage classes
    services/       KnowledgeAnalyticsEngine (facade), KnowledgeAnalyticsStatistics
    types/          shared TS types (KnowledgeMetricName, KnowledgeMetricCategory, KnowledgeReportType, ...)
    utils/          percentile/statistics/time-bucket pure helpers, clock, id generator
    index.ts        package barrel
  test/             mirrors src/, plus test/integration/ and test/helpers/ (.spec.ts, "test/" singular)
  README.md         this file
```

The Engineering Report lives at the **monorepo root**'s `docs/005.7P-KNOWLEDGE-ANALYTICS-REPORT.md`
— see "Design Decisions" below for why.

## Examples

### Recording and computing metrics directly on a service

```ts
import { KnowledgeQueryAnalytics } from "@aos/knowledge-analytics";

const query = new KnowledgeQueryAnalytics();
query.recordQueryTime(120);
query.recordQueryTime(95);
query.recordQueryTime(340);

query.averageQueryTime(); // 185
query.p95QueryTime(); // linear-interpolated 95th percentile
query.p99QueryTime(); // linear-interpolated 99th percentile
```

### Driving the full engine and pipeline

```ts
import { KnowledgeAnalyticsEngine } from "@aos/knowledge-analytics";

const engine = new KnowledgeAnalyticsEngine();

engine.search.recordSearch({ hit: true });
engine.search.recordSearch({ hit: false });
engine.retrieval.recordRetrieval({ cacheHit: true });
engine.embedding.recordEmbedding({ durationMs: 42, tokens: 128 });
engine.cost.recordEmbeddingCost(0.002, "openai");

const result = engine.runPipeline();

result.dashboardSnapshot?.metric("hit_rate"); // 0.5
result.reports; // 9 reports: Summary + 8 single-domain report types
engine.getReport(result.reports![0]!.id); // retrieve any generated report by id
```

### Building a specific report type

```ts
import { KnowledgeAnalyticsReportBuilder, KnowledgeReportType } from "@aos/knowledge-analytics";

const report = new KnowledgeAnalyticsReportBuilder()
  .withCost({ totalEmbeddingCost: 12.5, totalQueryCost: 3.25, totalCost: 15.75 })
  .build(KnowledgeReportType.Cost, { generatedAt: Date.now() });
```

### Supplying a custom event publisher / external metrics sink

```ts
import { KnowledgeAnalyticsEngine, InMemoryEventPublisher } from "@aos/knowledge-analytics";

const publisher = new InMemoryEventPublisher();
const engine = new KnowledgeAnalyticsEngine({
  eventPublisher: publisher,
  externalMetricsSink: { receive: (sample) => myLogger.log(sample) },
});

publisher.on("knowledge.analytics.report.generated", (payload) => {
  console.log("report generated:", payload);
});
```

## Public API

The package barrel (`src/index.ts`) exports every public symbol, grouped by folder. The most
commonly used entry points are:

| Symbol                                                                                                         | Kind         | Purpose                                                        |
| -------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------- |
| `KnowledgeAnalyticsEngine`                                                                                     | class        | Top-level facade: owns all 11 services + pipeline + registries |
| `KnowledgeAnalyticsPipeline`                                                                                   | class        | The 6-stage orchestrator, usable standalone from the engine    |
| `KnowledgeAnalyticsReportBuilder`                                                                              | class        | Builder for any of the 10 report types                         |
| `KnowledgeMetricRegistry`                                                                                      | class        | Id-keyed metric definition/value registry                      |
| `KnowledgeReportRegistry`                                                                                      | class        | Id-keyed generated-report registry                             |
| `KnowledgeMetricCalculator`                                                                                    | class        | Shared rate/average/percentile computation engine              |
| `KnowledgeUsage/Search/Retrieval/Query/Embedding/Graph/Quality/Performance/Trend/Cost/RecommendationAnalytics` | class (×11)  | The domain-specific analytics services                         |
| `KnowledgeAnalyticsReport`                                                                                     | entity       | One generated report                                           |
| `KnowledgeDashboardSnapshot`                                                                                   | entity       | One point-in-time metric snapshot                              |
| `KnowledgeAnalyticsSummary`                                                                                    | entity       | Operational rollup (samples/reports/metrics counts)            |
| `KnowledgeMetricSample`                                                                                        | value object | One recorded (name, value, timestamp, tags) data point         |
| `KnowledgeAnalyticsConfiguration`                                                                              | value object | Percentile thresholds, cadence metadata, retention limit       |
| `KnowledgeAnalyticsException` (+5)                                                                             | errors       | Local exception hierarchy                                      |
| `KnowledgeAnalyticsEventType`                                                                                  | enum         | The 6 domain event type strings                                |
| `InMemoryEventPublisher` / `NoOpEventPublisher`                                                                | class        | `IKnowledgeAnalyticsEventPublisher` implementations            |

## Metric Distribution (30 named metrics → 11 analytics services)

| Analytics Service                  | Owned Metrics                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `KnowledgeUsageAnalytics`          | Document Count, Indexed Count, Deleted Count, Storage Usage, Knowledge Usage, Provider Usage |
| `KnowledgeSearchAnalytics`         | Search Count, Hit Rate, Miss Rate                                                            |
| `KnowledgeRetrievalAnalytics`      | Retrieval Count, Cache Hit, Cache Miss                                                       |
| `KnowledgeQueryAnalytics`          | Average Query Time, P95 Query Time, P99 Query Time                                           |
| `KnowledgeEmbeddingAnalytics`      | Embedding Time, Token Usage                                                                  |
| `KnowledgeGraphAnalytics`          | Graph Node Count, Graph Edge Count, Connected Components, Average Graph Degree               |
| `KnowledgeQualityAnalytics`        | Success Rate, Failure Rate                                                                   |
| `KnowledgePerformanceAnalytics`    | Retrieval Time                                                                               |
| `KnowledgeTrendAnalytics`          | Trend Analysis, Historical Metrics                                                           |
| `KnowledgeCostAnalytics`           | Embedding Cost, Query Cost                                                                   |
| `KnowledgeRecommendationAnalytics` | Most Accessed Knowledge, Least Accessed Knowledge                                            |

No metric is orphaned; every service owns at least one. See the Engineering Report
(`docs/005.7P-KNOWLEDGE-ANALYTICS-REPORT.md`) for the rationale behind reassignments relative to a
naive reading of the specification's grouping (e.g. Success/Failure Rate moved to
`KnowledgeQualityAnalytics` rather than `KnowledgeSearchAnalytics`).

## Design Decisions

1. **Ten report types, one flexible aggregate.** Rather than 10 distinct TypeScript classes, a
   single `KnowledgeAnalyticsReport` entity is parameterized by `KnowledgeReportType` with a
   `sections` bag. `KnowledgeAnalyticsReportBuilder` enforces, per type, which sections are
   required: the 8 single-domain types (Usage, Performance, Graph, Quality, Embedding, Trend,
   Cost, Recommendation) require exactly their one matching section and reject `.build()` without
   it (`InvalidReportTypeException`); `Summary` and `DashboardSnapshot` are composite and include
   every section supplied so far, with none required. This keeps report content genuinely
   different per type (verified by dedicated tests) while avoiding 10 near-identical classes.
2. **`KnowledgeDashboardSnapshot` is a separate entity, not a report-builder output.** The pipeline
   spec lists "Generate Dashboard Snapshot" as its own stage (5), distinct from "Generate Reports"
   (4), so a `KnowledgeDashboardSnapshotFactory` builds it directly from the numeric KPI map rather
   than through the report builder — even though `DashboardSnapshot` is also modeled as one of the
   10 `KnowledgeReportType` values for report-builder consistency (a host can request an all-
   sections "report" of that type too, if useful).
3. **Percentile method: linear interpolation between closest ranks.** `index = p/100 * (n-1)`, then
   interpolate between the floor and ceiling ranks. Matches NumPy's default `percentile()` /
   Excel's `PERCENTILE.INC`. Documented and hand-verified in `src/utils/percentile.ts` and its
   spec file against known datasets (e.g. 1..100 → P95 = 95.05, P99 = 99.01).
4. **Trend computation: OLS slope + period-over-period delta over time-bucketed history.** Samples
   are grouped into fixed-width buckets (`KnowledgeAnalyticsConfiguration.trendBucketSizeMs`,
   default 1 hour), each bucket's average is taken, and the trend is reported two ways: an ordinary
   least-squares regression slope across bucket averages (`trendSlope`) and a simple ratio delta
   between the last two buckets (`periodOverPeriodDelta`). Both are hand-verified against a known
   5-point dataset.
5. **Rate of 0/0 is defined as 0, not `NaN`.** Every rate calculation (`calculateRate`) returns
   exactly `0` when the denominator is `0`, keeping every report/dashboard deterministic even
   before any samples have been recorded, rather than producing `NaN`/`Infinity` that would
   propagate through JSON serialization as `null` or break downstream math.
6. **`KnowledgeMetricCategory` (11 values) is distinct from `KnowledgeMetricUnit` (8 values).**
   Category answers "which analytics service owns this metric"; unit answers "what physical
   quantity does this value represent" (count, ratio, milliseconds, bytes, tokens, currency,
   degree, score). Both are attached to a metric's `KnowledgeMetricDefinition`.
7. **`KnowledgeAnalyticsStatistics` vs. domain `Metrics`.** Following the same split every
   completed sibling package uses: `KnowledgeAnalyticsStatistics` counts this package's own
   operational activity (how many samples were recorded, how many reports were generated, pipeline
   run success/failure counts, events published) — never influenced by what the recorded _values_
   were. The domain `Metrics` (Hit Rate, P95 Query Time, ...) are a completely separate concern
   computed by the analytics services.
8. **`KnowledgeQualityAnalytics` owns Success/Failure Rate, not `KnowledgeSearchAnalytics`.** The
   raw specification's metric list groups these near the search-related metrics, but semantically
   they read as generic quality/outcome indicators applicable to any operation (embedding
   succeeded, retrieval succeeded, sync succeeded, ...), so `KnowledgeSearchAnalytics` was scoped
   down to Search Count/Hit Rate/Miss Rate only, and `KnowledgeQualityAnalytics` was given
   Success/Failure Rate plus a derived composite "Quality Score" (currently defined as the success
   rate) for report readability.
9. **`KnowledgePerformanceAnalytics` owns Retrieval Time, generalized via `recordOperation(name, durationMs)`.**
   The raw metric list places "Retrieval Time" separately from "Retrieval Count/Cache Hit/Cache
   Miss" (owned by `KnowledgeRetrievalAnalytics`), so latency and outcome tracking for retrieval
   were deliberately split across two services — `KnowledgePerformanceAnalytics` is positioned as
   this package's general latency-tracking home, with Retrieval Time as its one named-metric
   anchor and `recordOperation` as a documented extension point for tracking other operations'
   latency without inventing new named metrics.
10. **`KnowledgeAnalyticsConfiguration.dashboardRefreshCadenceMs` is metadata only.** Since this
    package is standalone/in-memory with no timers or schedulers, the field exists purely so a host
    application can read the intended cadence and drive its own scheduling loop calling
    `engine.runPipeline()`.

## Known Limitations

- **No real persistence.** Every recorded sample, generated report, and dashboard snapshot lives
  only in process memory and is lost on restart. A host application that needs durability must
  persist `KnowledgeAnalyticsReport`/`KnowledgeDashboardSnapshot` objects (or the raw
  `KnowledgeMetricSample`s) itself.
- **No cross-package data pulling.** Because the package is standalone, it cannot query
  `@aos/knowledge-graph`, `@aos/knowledge-retrieval`, etc. directly — every number must be pushed
  in by the caller via the `recordX(...)` methods.
- **`historyRetentionLimit` is per-service, not per-metric-name-across-services.** Setting it
  bounds how many samples each analytics service keeps _per metric name it owns_; it does not cap
  total memory across the whole engine.
- **Trend bucket boundaries are anchored to the first recorded sample's timestamp**, not to
  wall-clock hour/day boundaries — two `KnowledgeTrendAnalytics` instances started at different
  times will bucket the same wall-clock period differently.
- **No built-in scheduling.** `dashboardRefreshCadenceMs` is advisory metadata; nothing in this
  package calls `runPipeline()` on a timer. Hosts must drive the pipeline themselves.

## Extension Points

- **`IKnowledgeAnalyticsEventPublisher`**: supply your own implementation to
  `KnowledgeAnalyticsEngine`'s `eventPublisher` option to bridge events onward (e.g. to the real
  AOS event bus in a host application).
- **`IExternalMetricsSink`**: optionally supply one to `KnowledgeAnalyticsEngine` and call
  `engine.mirrorToExternalSink(sample)` to forward samples elsewhere (a log, a real metrics
  backend adapter) without this package depending on that backend.
- **`IKnowledgeAnalyticsModule`**: `KnowledgeAnalyticsEngine` implements this `id`/`start`/`stop`
  shape so any host that duck-types against `@aos/runtime-kernel`'s `IModule` can integrate it
  without a compile-time dependency.
- **Custom pipeline stage lists**: `new KnowledgeAnalyticsPipeline(customStages)` accepts any array
  of `PipelineStage` objects, letting a host insert/replace/remove stages.
- **`KnowledgePerformanceAnalytics.recordOperation(name, durationMs)`**: track latency for any
  named operation beyond Retrieval Time without needing a new analytics service.
