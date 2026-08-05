# @aos/knowledge-indexing

The AOS Enterprise Knowledge Indexing Engine — the vendor-neutral indexing layer that
prepares searchable indexes for future retrieval. **This package implements no
retrieval, no query answering, no RAG, no LLM calls, no vector database implementation,
and no embedding generation.** It only creates, updates, maintains, validates, and
optimizes indexes. See `docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md` for the explicit scope
boundary and `docs/005.7C-KNOWLEDGE-INDEXING-REPORT.md` for the readiness checklist
handed to the next Enterprise Retrieval phase.

## Public API

`KnowledgeIndexing`, `KnowledgeIndexingSystem`, `KnowledgeIndexer`,
`KnowledgeIndexRegistry`, `KnowledgeIndexManager`, `KnowledgeIndexBuilder`,
`KnowledgeIndexValidator`, `KnowledgeIndexPipeline`, `KnowledgeIndexContext`,
`KnowledgeIndexFactory`, `KnowledgeIndexMetrics`, `KnowledgeIndexHealth`,
`KnowledgeIndexMonitor`, `KnowledgeIndexEvents`, `KnowledgeIndexScheduler`,
`KnowledgeIndexOptimizer`, `KnowledgeIndexStatistics`, `KnowledgeIndexResolver` — the 18
names required by the source prompt. `src/index.ts` also re-exports the
Domain/Contracts/Errors surface a caller needs to actually build and use them.

## Quick example

```ts
import { EventBroker } from "@aos/event-bus";
import {
  KnowledgeAssetType,
  KnowledgeClassification,
  DocumentFactory,
  buildKnowledgeNamespaceUri,
} from "@aos/knowledge-engine";
import {
  KnowledgeIndexEvents,
  KnowledgeIndexing,
  KnowledgeIndexType,
} from "@aos/knowledge-indexing";

const bus = new EventBroker();
const indexing = new KnowledgeIndexing({ events: new KnowledgeIndexEvents(bus) });

// A KnowledgeAsset already saved by @aos/knowledge-engine's own write path.
const asset = new DocumentFactory().create({
  namespace: buildKnowledgeNamespaceUri("tenant-1", "ws-1", "lib-1", "doc-1"),
  assetType: KnowledgeAssetType.SUPPORT,
  scope: { tenantId: "tenant-1", workspaceId: "ws-1" },
  classification: KnowledgeClassification.INTERNAL,
  ownerId: "user-1",
  tags: ["billing", "faq"],
});

const entries = await indexing.indexAsset({
  asset,
  context: indexing.factory.createContext({ assetId: asset.id, tenantId: "tenant-1" }),
  indexTypes: [KnowledgeIndexType.KEYWORD, KnowledgeIndexType.TAG, KnowledgeIndexType.NAMESPACE],
});
// entries — one KnowledgeIndexEntry per requested type (2 for TAG since there are 2 tags)
```

## Architecture

```
@aos/knowledge-engine (KnowledgeAsset — read-only input)
        │
        ▼
KnowledgeIndexing (indexing/) — the public façade
        │
        ▼
KnowledgeIndexer (indexer/) — runs one Pipeline invocation per Asset, publishes events
        │
        ▼
KnowledgeIndexPipeline
  Validation → Metadata → Classification → Namespace → Policy → Permission →
  Relationship → Builder → Registry → Metrics
        │
        ▼
KnowledgeIndexBuilder — pure data transformation, one Entry per Index Type
        │
        ▼
KnowledgeIndexManager
  ├── KnowledgeIndexRegistry   (7 buckets)
  ├── KnowledgeIndexStatistics (per-Index-Type counters)
  └── KnowledgeIndexScheduler  (in-memory job ledger)
        │
        ▼
KnowledgeIndexResolver / KnowledgeIndexOptimizer
        │
        ▼
contracts/ — 8 interface-only extension points, zero implementations
```

## Index Types

17 types: Keyword, Metadata, Namespace, Relationship, Policy, Permission, Template, Tag,
Category, Language, Workspace, Tenant, Department, Collection, Asset Type, Embedding
Reference, Hybrid Metadata. `KnowledgeIndexBuilder` produces one `KnowledgeIndexEntry` per
requested type (`TAG` produces one per tag).

## Chunk References & Embedding References

Neither is ever generated here. `KnowledgeChunkReference` and `KnowledgeEmbeddingReference`
are pure pointers a future Chunking/Embedding package populates — "Do NOT chunk
documents. Store ONLY chunk references." / "Never generate embeddings. Only store
references."

## Pipeline

10 stages, in fixed order: Validation → Metadata → Classification → Namespace → Policy →
Permission → Relationship → Builder → Registry → Metrics. Policy/Permission are
permissive by default when no `IKnowledgeIndexChecker` is configured. A rerun for the
same Asset replaces rather than duplicates Registry entries.

## Registry

One generic class covering all 7 buckets the source prompt requires (Index/Version/
Namespace/Template/Policy/Relationship/Statistics).

## Validation

8 stages run in fixed order, aggregating every issue: Namespace, Metadata, Relationships,
Policy, Permission, Embedding Reference, Duplicate, Consistency.

## Optimizer

`KnowledgeIndexOptimizer` owns no optimization logic — "Interface only. No optimization
logic." Every operation (Merge/Split/Compaction/Vacuum/Rebuild) delegates to an injected
`IKnowledgeIndexOptimizer`, throwing `IndexOptimizationNotSupportedException` when none is
configured.

## Scheduler

An in-memory job ledger tracking Reindex/Incremental/Full/Version Update/Policy Update/
Relationship Update requests through pending → running → completed/failed/cancelled. This
package never performs the actual reindex work — a caller reacts to a scheduled job by
calling `KnowledgeIndexing.reindexAsset()`.

## Metrics

```
KnowledgeIndexMetrics
├── indexCount / buildCount / buildFailures / rebuildCount / optimizeCount
├── averageBuildTimeMs
├── tenantUsage / workspaceUsage
└── entriesByType
```

## Health

5 statuses (Healthy/Warning/Degraded/Unavailable/Unknown). `KnowledgeIndexHealth.check()`
derives Registry health from whether anything is registered, and Build health from the
live `buildFailures/buildCount` ratio.

## Monitoring

`KnowledgeIndexMonitor.sample()` combines a Metrics snapshot and a Health report into one
`KnowledgeIndexDashboard`.

## Folder Structure

| Folder        | Contents                                                                 |
| ------------- | ------------------------------------------------------------------------ |
| `domain/`     | 17 Index Types + `KnowledgeIndexEntry`/Chunk/Embedding Reference schemas |
| `contracts/`  | 8 interface-only extension points                                        |
| `errors/`     | `KnowledgeIndexException` + 10 concrete subclasses                       |
| `context/`    | `KnowledgeIndexContext`, `createKnowledgeIndexContext()`                 |
| `registry/`   | `KnowledgeIndexRegistry` (7 generic buckets)                             |
| `resolver/`   | `KnowledgeIndexResolver` — read-only pass-through                        |
| `builder/`    | `KnowledgeIndexBuilder` — pure data transformation                       |
| `validator/`  | 8 validator stages + `KnowledgeIndexValidator` aggregator                |
| `pipeline/`   | `KnowledgeIndexPipeline` — 10-stage fixed sequence                       |
| `statistics/` | `KnowledgeIndexStatistics`                                               |
| `scheduler/`  | `KnowledgeIndexScheduler` — in-memory job ledger                         |
| `optimizer/`  | `KnowledgeIndexOptimizer` — interface-only delegate                      |
| `manager/`    | `KnowledgeIndexManager` — Registry + Statistics + Scheduler orchestrator |
| `factory/`    | `KnowledgeIndexFactory`                                                  |
| `events/`     | `KnowledgeIndexEvents`, `KnowledgeIndexEventType` (7 values)             |
| `metrics/`    | `KnowledgeIndexMetrics`                                                  |
| `health/`     | `KnowledgeIndexHealth`                                                   |
| `monitoring/` | `KnowledgeIndexMonitor`                                                  |
| `indexer/`    | `KnowledgeIndexer` — runs one Pipeline invocation per Asset              |
| `indexing/`   | `KnowledgeIndexing` — the public façade                                  |
| `bootstrap/`  | `KnowledgeIndexingSystem` — implements `@aos/runtime-kernel`'s `IModule` |
| `config/`     | `KnowledgeIndexingConfig`                                                |

## Event Bus namespace

`knowledge.index.created`, `.updated`, `.deleted`, `.rebuilt`, `.optimized`, `.failed`,
`.health.changed` — every one published via the real `@aos/event-bus` `IPublisher`.

## Known Limitations

- **All 8 extension-point contracts have zero implementations** — by design.
- **`KnowledgeIndexOptimizer` has zero real optimization logic** — pure delegate.
- **`KnowledgeIndexScheduler` never performs the reindex work it schedules** — job ledger
  only.
- **`knowledge.index.health.changed` is declared but never published** — no scheduled
  Health-diffing sampler exists in this package.

## Future Integration

`IKnowledgeEmbeddingProvider`/`IKnowledgeChunkProvider`/`IKnowledgeVectorProvider`/
`IKnowledgeKeywordIndexer`/`IKnowledgeMetadataIndexer`/`IKnowledgeGraphIndexer`/
`IKnowledgeIndexOptimizer`/`IKnowledgeIndexStorage` are this package's eight extension
points for later Engineering Tasks. See `docs/005.7C-KNOWLEDGE-INDEXING-REPORT.md` for
the full readiness checklist handed to the next Retrieval phase.

## Persistence

None. `KnowledgeIndexRegistry`/`KnowledgeIndexScheduler` are in-memory only.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.7C-KNOWLEDGE-INDEXING-REPORT.md` for coverage numbers, known limitations, and
the readiness checklist for the next Retrieval phase — **not implemented in this
package**.
