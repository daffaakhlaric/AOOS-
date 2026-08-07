# @aos/knowledge-intelligence

Enterprise Knowledge Intelligence Engine for the AOS (Agent Operating System) Runtime — Engineering Task 005.7R.

Analyzes knowledge, discovers insights, identifies relationships, detects gaps and duplicates, classifies and tags knowledge, scores health/freshness/coverage/completeness/readiness/quality/risk/priority, recommends improvements, and generates intelligence reports across the Knowledge Runtime.

This package does **not** perform retrieval, graph storage, indexing, orchestration, analytics collection, or persistence.

## Architecture

Follows the AOS Engineering Constitution: Domain-Driven Design, SOLID, Clean Architecture, Immutable Domain Models, Value Objects, Entities, Factory Pattern, Builder Pattern, Registry Pattern, Strategy Pattern, Specification Pattern, Pipeline Pattern, Event-Driven Architecture, strict TypeScript, zero `any`, zero TODO, zero placeholder implementation.

**Standalone.** This package imports **zero** other `@aos/*` packages at runtime. It defines its own:

- Exception base (`KnowledgeIntelligenceException`) instead of extending `@aos/errors`' `AosError`.
- Lightweight event-publishing contract (`IKnowledgeIntelligenceEventPublisher`) instead of importing `@aos/event-bus`.
- Minimal `IModule`-shaped contract (`IKnowledgeIntelligenceModule`) instead of importing `@aos/runtime-kernel`.

`devDependencies` may reference tooling packages (`@aos/eslint-config`, `@aos/testing`, `@aos/tsconfig`, `@aos/vitest-config`); `dependencies` is empty.

**No database. No networking. No filesystem. No external AI model. No external embedding provider.** Everything executes synchronously, in-memory. All time-dependent logic (freshness, staleness) depends on an injectable `IClock` — never a bare `Date.now()` call inside domain logic — so every test is deterministic and reproducible.

### Why classical deterministic algorithms instead of "AI"

There is no external LLM or embedding provider available to this package (by design — it must remain standalone and offline-safe). Every "intelligence" capability is instead computed from real, classical, explainable algorithms operating on **caller-supplied structured input** (a `KnowledgeItemSnapshot` — tags, category hints, content length, completeness ratios, timestamps, etc.). This package never parses raw unstructured text itself:

- **Similarity** — the Jaccard index (`|A ∩ B| / |A ∪ B|`) over each item's tag set is the primary signal; cosine similarity over an optional numeric feature vector is a secondary signal when both items supply one.
- **Classification** — a genuine Specification-pattern rules engine (`ISpecification<T>` predicates, with `And`/`Or`/`Not` combinators) evaluated in priority order, not a trained model.
- **Scoring** — a shared weighted-average + normalization + threshold-evaluation utility, reused by every scoring engine, applied to caller-supplied structured signals.
- **Gap/Orphan detection** — plain set-difference and adjacency-list connectivity checks over caller-supplied taxonomy/edge data.
- **Relationship discovery** — similarity-threshold and shared-tag-count based inference.

## Features

- **11-stage Analysis Pipeline** (`KnowledgeIntelligencePipeline`): Collect Knowledge → Analyze Structure → Analyze Relationships → Analyze Similarity → Analyze Coverage → Analyze Quality → Analyze Freshness → Analyze Risks → Generate Recommendations → Generate Intelligence Report → Publish Events.
- **26 Intelligence Capabilities**: Health/Freshness/Coverage/Completeness/Readiness/Quality/Risk/Priority scoring; Duplicate/Near-Duplicate/Semantic-Similarity detection; Relationship Discovery; Gap/Coverage/Staleness/Orphan/Conflict detection; Classification, Auto-Category and Auto-Tag suggestion; Improvement/Merge/Archive/Update/Split/Consolidation recommendations.
- **14 Report types** via one flexible, parameterized report entity (see Design Decisions).
- **14 domain Events**, published through a local in-memory event publisher (swappable for a host-supplied bridge).
- **35+ Core Components** across 19 `src/` subfolders (contracts, entities, value-objects, services, intelligence, recommendation, analysis, scoring, classification, similarity, gap, pipeline, builders, factories, registry, events, errors, types, utils).

## Folder Structure

```
packages/knowledge-intelligence/
  src/
    contracts/       IClock, event-publisher/module contracts, ISpecification
    entities/        KnowledgeIntelligenceReport, KnowledgeHealthReport, KnowledgeGapReport, KnowledgeIntelligenceSnapshot
    value-objects/   KnowledgeScore, KnowledgeHealthScore, KnowledgePriorityScore, KnowledgeReadinessScore,
                      KnowledgeClassification, KnowledgeSimilarityMatrix, KnowledgeRecommendation, KnowledgeInsight,
                      KnowledgeFinding, KnowledgeIntelligenceConfiguration, KnowledgeIntelligenceStatistics
    services/        KnowledgeIntelligenceStatisticsService (registry-level summarization)
    intelligence/    KnowledgeIntelligenceEngine (facade), KnowledgeInsightEngine, KnowledgeHealthEngine, KnowledgeReadinessEngine
    analysis/        KnowledgeAnalysisEngine, KnowledgeRelationshipAnalyzer, KnowledgeRiskAnalyzer, KnowledgeFreshnessEngine
    recommendation/  KnowledgeRecommendationEngine, KnowledgeRecommendationBuilder, KnowledgeInsightBuilder, KnowledgePriorityEngine
    scoring/         KnowledgeScoreComputer (shared math), KnowledgeQualityScoringEngine
    classification/  KnowledgeClassificationEngine, KnowledgeTagSuggestionEngine, specifications/ (11 predicates incl. And/Or/Not)
    similarity/      KnowledgeSimilarityEngine, KnowledgeDuplicateDetector
    gap/             KnowledgeGapAnalyzer, KnowledgeCoverageAnalyzer
    pipeline/        KnowledgeIntelligencePipeline + 11 stages/
    builders/        KnowledgeIntelligenceReportBuilder
    factories/       6 Factory-pattern classes for entities/VOs
    registry/        KnowledgeIntelligenceRegistry (id-keyed buckets)
    events/          14 event types, InMemoryEventPublisher, NoOpEventPublisher
    errors/          KnowledgeIntelligenceException + 7 concrete subclasses
    types/           enums, KnowledgeItemSnapshot and other shared shapes
    utils/           SystemClock/ManualClock, id-generator, similarity-math, scoring-math
  test/              90+ *.spec.ts files, mirroring src/, plus test/integration/
  README.md
docs/005.7R-KNOWLEDGE-INTELLIGENCE-REPORT.md   (monorepo root — see "Folder Structure" judgment call below)
```

**Folder-structure judgment call**: the spec's raw listing runs `src/{...19 folders...}` then `tests/`, `README.md`, and `docs/005.7R-...REPORT.md` as if nested under `src/` — informal, not literal. Following the same resolution used by the three immediately-prior standalone siblings (005.7O/P/Q): the package root has `src/` (19 subfolders), a top-level `test/` folder (singular), a package-local `README.md`, and the Engineering Report lives in the **monorepo root's** `docs/` folder, not `packages/knowledge-intelligence/docs/`.

## Public API

The intended integration surface is `KnowledgeIntelligenceEngine`:

```ts
import { KnowledgeIntelligenceEngine } from "@aos/knowledge-intelligence";

const engine = new KnowledgeIntelligenceEngine();

const context = engine.runIntelligence({
  items: [
    {
      id: "doc-1",
      title: "Billing overview",
      tags: ["billing", "overview"],
      contentLength: 400,
      requiredFieldsPresent: 4,
      requiredFieldsTotal: 4,
      lastUpdatedAt: Date.now(),
      createdAt: Date.now(),
      hasSummary: true,
      hasExamples: true,
      hasOwner: true,
    },
  ],
  taxonomy: [{ topic: "billing", covered: true, itemCount: 1 }],
  adjacency: {},
});

context.report; // KnowledgeIntelligenceReport
context.healthReport; // KnowledgeHealthReport
context.gapReport; // KnowledgeGapReport
context.recommendations; // readonly KnowledgeRecommendation[]
context.insights; // readonly KnowledgeInsight[]
context.statistics; // KnowledgeIntelligenceStatistics

engine.classify(item); // KnowledgeClassification
engine.suggestTags(item, cooccurrenceTable); // readonly string[]
engine.suggestTagsFromSimilarItems(item, corpus); // readonly string[]
engine.takeSnapshot({ items }); // KnowledgeIntelligenceSnapshot
```

Every constructor/engine that needs time or events accepts them via injection:

```ts
import {
  ManualClock,
  InMemoryEventPublisher,
  KnowledgeIntelligenceEngine,
} from "@aos/knowledge-intelligence";

const clock = new ManualClock(1_700_000_000_000);
const events = new InMemoryEventPublisher(clock);
const engine = new KnowledgeIntelligenceEngine({ clock, eventPublisher: events });
```

## Examples

**Duplicate detection with hand-verifiable Jaccard math:**

```ts
import {
  KnowledgeSimilarityEngine,
  KnowledgeIntelligenceConfiguration,
} from "@aos/knowledge-intelligence";

const engine = new KnowledgeSimilarityEngine(KnowledgeIntelligenceConfiguration.default());
const entry = engine.compare(
  { id: "a", tags: ["billing", "invoice", "tax"] /* ... */ } as never,
  { id: "b", tags: ["billing", "invoice", "tax", "refund"] /* ... */ } as never,
);
// entry.jaccard === 0.75 (3 shared / 4 union) -> classification: "near_duplicate"
```

**Composite scoring with configurable weights:**

```ts
import { KnowledgeScoreComputer } from "@aos/knowledge-intelligence";

const computer = new KnowledgeScoreComputer();
const score = computer.aggregate(
  "quality",
  [
    { name: "completeness", value: 80, weight: 0.5 },
    { name: "structuralRichness", value: 100, weight: 0.3 },
    { name: "lengthAdequacy", value: 60, weight: 0.2 },
  ],
  [
    { label: "excellent", min: 90 },
    { label: "good", min: 70 },
    { label: "fair", min: 50 },
    { label: "poor", min: 0 },
  ],
);
// score.value === 82, score.band === "good"
```

## Extension Points

- **`ISpecification<T>`** — register custom classification rules by constructing a `KnowledgeClassificationEngine` with `extraRules`, evaluated ahead of the built-ins.
- **`IKnowledgeIntelligenceEventPublisher`** — supply a custom publisher (e.g. bridging to a host's real event bus) instead of `InMemoryEventPublisher`.
- **`IClock`** — supply `ManualClock` for deterministic tests/replay, or any custom implementation.
- **`KnowledgeIntelligenceConfiguration`** — every weight, threshold, and band is configurable and immutable-with-overrides via `.with(...)`.
- **`KnowledgeIntelligencePipeline`** — accepts a custom `PipelineStage[]` list at construction, so hosts can insert/remove/reorder stages.
- **`KnowledgeIntelligenceReportBuilder`** — build any of the 14 `ReportType`s with caller-assembled `sections`.

## Design Decisions

1. **One flexible report entity for 14 report types.** Rather than 14 distinct entity classes, `KnowledgeIntelligenceReport` is parameterized by `ReportType` with a `sections: Record<string, unknown>` payload assembled by `KnowledgeIntelligenceReportBuilder`. `KnowledgeHealthReport` and `KnowledgeGapReport` remain dedicated entities because the spec names them explicitly as Core Components with a fixed, well-typed shape (overall + per-item scores; coverage + gaps + orphans respectively).
2. **Shared `KnowledgeScoreComputer`.** Normalization, weighted aggregation, and threshold evaluation are implemented once (`utils/scoring-math.ts`, wrapped by `scoring/knowledge-score-computer.ts`) and reused by every scoring engine (Health, Quality, Freshness, Risk, Priority, Readiness, Coverage) instead of eight separate implementations.
3. **Health bands**: Healthy ≥ 80, At Risk 50–79, Critical < 50 (lower-bound-inclusive). **Risk bands**: Critical ≥ 80, High ≥ 60, Moderate ≥ 30, Low < 30. Both configurable via `KnowledgeIntelligenceConfiguration`.
4. **Similarity thresholds**: Duplicate ≥ 0.95, Near-Duplicate ≥ 0.70, Related ≥ 0.50, else Distinct — all Jaccard-index-based, all configurable, validated to be strictly decreasing at construction time.
5. **Freshness decay is linear**: `score = 100 * (1 - age / freshnessMaxAgeMs)`, clamped to `[0, 100]`, default `freshnessMaxAgeMs` = 90 days.
6. **Registry buckets**: reports, snapshots, recommendations, insights — the four artifact kinds a host needs to look back up by id after a pipeline run; findings/scores are transient pipeline-context data, not separately registered.
7. **Recommendation rules are priority-ordered but not mutually exclusive** — a single item can receive multiple recommendation types in one run (e.g. both Update and Improvement) if multiple conditions hold; Merge/Consolidation are evaluated per-pair, Archive/Update/Split/Improvement per-item.
8. **Classification confidence** = `1 / matchedRuleCount` — fewer, more distinctive rule matches yield higher confidence; ties are broken by rule-registration order (first match wins for the `category` returned).
9. **Coverage is a corpus-level concept** — `KnowledgeHealthEngine.score()` accepts an optional per-call `coverageScore` (defaulting to 100) rather than trying to derive per-item coverage, since coverage inherently describes how well a taxonomy is covered across the whole corpus, not one item.

## Known Limitations

- No persistence: every registry/report/statistic lives only as long as the process; hosts that need durability must persist `KnowledgeIntelligenceReport`/`KnowledgeIntelligenceSnapshot` themselves.
- Similarity and classification operate only on caller-supplied structured fields (tags, category hints, structural flags) — this package cannot infer similarity from raw prose without the caller first extracting structured signals, since no embedding model is available.
- Relationship discovery and gap/orphan detection are intentionally shallow (pairwise similarity/shared-tags; adjacency-list connectivity) — this package does not build or own a knowledge graph; pair it with `knowledge-graph` upstream for deeper graph analytics.
- `KnowledgeIntelligencePipeline`'s 11 stages run strictly sequentially and synchronously; very large corpora (many thousands of items) will pay an O(n²) cost in the pairwise similarity/relationship stages.
