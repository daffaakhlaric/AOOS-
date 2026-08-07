# @aos/embedding-manager

The AOS Enterprise Embedding Manager Platform — orchestrates embedding lifecycle,
embedding metadata, provider abstraction, model registry, embedding versioning,
embedding jobs, cache metadata, and embedding contracts. This package owns ONLY
embedding orchestration, embedding metadata, embedding lifecycle, embedding jobs,
embedding sessions, embedding requests, embedding result metadata, embedding
providers, embedding models, embedding versions, embedding cache metadata, embedding
statistics, and embedding audit. It MUST NEVER generate embeddings, MUST NEVER
perform vector search, and MUST NEVER connect directly to a vector database — all real
embedding generation, storage, and search work is delegated through `IEmbeddingProvider`/
`IEmbeddingModelProvider`/`IEmbeddingStorageProvider`/`IEmbeddingCacheProvider`
interfaces this package never implements. See `docs/PROMPT-005.7N-EMBEDDING-MANAGER.md`
for the explicit scope boundary and `docs/005.7N-EMBEDDING-MANAGER-REPORT.md` for the
readiness checklist handed to the next phase (005.7O Knowledge Graph).

## Public API

`EmbeddingManager`, `EmbeddingManagerSystem`, `EmbeddingRegistry`, `EmbeddingResolver`,
`EmbeddingValidator`, `EmbeddingPipeline`, `EmbeddingMiddleware`, `EmbeddingFactory`,
`EmbeddingContext`, `EmbeddingSession`, `EmbeddingLifecycle`, `EmbeddingStateMachine`,
`EmbeddingEvents`, `EmbeddingMetrics`, `EmbeddingHealth`, `EmbeddingMonitoring`,
`EmbeddingStatistics` — the 17 names required by the prompt (one fewer than every
prior sibling: this package drops the "Knowledge" prefix entirely, so there is no
second, internal-composition "...Manager" name — see "Architecture" below for how that
was resolved). `src/index.ts` also re-exports the full Domain/Contracts/Errors/
Validator-stage surface a caller needs to actually build and use them, matching the
curation style established by every prior AOS Knowledge package.

The read-only per-Embedding domain view returned by every operation is exported
separately as `EmbeddingRecord` (`domain/embedding-record.ts`), to avoid a same-name
collision with the `EmbeddingManager` façade.

## Quick example

```ts
import {
  EmbeddingManager,
  EmbeddingProviderType,
  EmbeddingModelName,
  createEmbeddingContext,
} from "@aos/embedding-manager";

const manager = new EmbeddingManager(publisher);

// Setup: register a Provider + a compatible Model (metadata only — no implementation).
await manager.registerProvider({
  name: "OpenAI",
  type: EmbeddingProviderType.OPENAI,
  tenantId: "tenant-1",
});
await manager.registerModel({
  name: EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
  providerType: EmbeddingProviderType.OPENAI,
  tenantId: "tenant-1",
});

// The package NEVER ships a Provider implementation — a caller must register one via
// config before start() can record any EmbeddingResultMetadata.
const configured = new EmbeddingManager(publisher, {
  provider: myProviderAdapter, // IEmbeddingProvider
});

const context = createEmbeddingContext({ embeddingId: "e-1", tenantId: "tenant-1" });

const created = await manager.createEmbedding({
  context,
  title: "Q3 FAQ embedding batch",
  textReference: "kb://faq/q3-2026", // NEVER actual text content
  providerType: EmbeddingProviderType.OPENAI,
  modelName: EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
  requestedBy: "user-1",
});
// created.state === "draft"

await manager.queue({ token: created.token });
const prepared = await manager.prepare({ token: created.token }); // resolves Provider/Model/Namespace/Configuration
// prepared.resolvedProvider / prepared.resolvedModel are now populated

const started = await manager.start({ token: created.token }); // invokes myProviderAdapter.embed()
// started.state === "embedding"; started.resultMetadata holds dimensionCount, NEVER a vector

const completed = await manager.complete({ token: created.token });
// completed.state === "completed"
```

## Architecture

Follows the identical architecture established by every completed AOS Knowledge
package (`@aos/knowledge-generator`, `@aos/knowledge-marketplace`,
`@aos/knowledge-quality`, `@aos/knowledge-validator`): contract-first,
metadata-driven, event-driven, vendor-neutral, and strictly an orchestrator.
`EmbeddingManager` (the façade, `embedding/embedding-manager.ts`) composes:

- **Registry** (`EmbeddingRegistry`) — 8 in-memory, id-keyed buckets, Map lookups
  only, never scanned.
- **Resolver** (`EmbeddingResolver`) — the 5 named resolution dimensions as method
  pairs on one class, plus an extra resolver-local Configuration map (see
  "Registry" below).
- **Validator** (`EmbeddingValidator`) — exactly 12 pure-function stages
  aggregating structural issues without short-circuiting.
- **Pipeline** (`EmbeddingPipeline`) — exactly 10 stages driving one Embedding
  Operation end to end: runs the Validator, resolves Provider/Model/Namespace/
  Configuration, stamps Metadata/Metrics, drives the State Machine, and appends
  Audit/Logging.
- **Middleware** (`EmbeddingMiddleware`) — Koa-style `embedding.use(...)` chain,
  async-capable, double-`next()` guarded.
- **State Machine** (`EmbeddingStateMachine`) + **Lifecycle** (`EmbeddingLifecycle`)
  — the only code allowed to mutate `Embedding.state`, plus a read-only companion
  for introspection.
- **Session** (`EmbeddingSession`) — Open/Resume/Close/Cancel/Expire/Renew
  access-window lifecycle.
- **Events** (`EmbeddingEvents`) — publishes onto the real `@aos/event-bus`
  `IPublisher`, producer `"@aos/embedding-manager"`.
- **Metrics/Health/Monitoring/Statistics** — the observability quartet, all real
  running computations (never stubs).
- **Factory** (`EmbeddingFactory`) — 6 named sub-factories composing every domain
  record.

### The manager/embedding naming-collision resolution

The spec's own "Package Structure" lists both a `manager/` folder AND an
`embedding/` folder as siblings — mirroring the `manager/` (composition) +
`<domain-name>/` (public facade) split established by `@aos/knowledge-validator`'s
`manager/`+`validation/` and `@aos/knowledge-quality`'s `manager/`+`quality/`. But
this package's Public API list has ONLY `EmbeddingManager` as the single top-level
orchestrator name — there is no second "manager" name to spare, unlike every prior
sibling (`KnowledgeValidatorManager` vs `KnowledgeValidator`). This was resolved by
naming the low-level composition class (Registry + Session + Statistics +
token-keyed ledger — the internal analog of `KnowledgeValidatorManager`)
`EmbeddingManagerLedger` (`manager/embedding-manager-ledger.ts`) and deliberately
**not** exporting it from `src/index.ts`. The actual Public API class literally
named `EmbeddingManager` lives in `embedding/embedding-manager.ts` and composes
`EmbeddingManagerLedger` as one internal collaborator alongside the StateMachine/
Pipeline/Middleware/Resolver/Validator/Events.

This package NEVER calls an AI SDK, generates an embedding, performs vector search,
or connects to a vector database. Every "Embedding Operation" is metadata/lifecycle
work: create an embedding request record, drive it through the state machine, and —
only inside `start()` — optionally invoke a caller-supplied `IEmbeddingProvider`
through its interface, recording only the `EmbeddingResultMetadata` it returns
(dimension count, provider-reported metadata) — **never** the vector itself.

## Domain Model

The 14 named domain aggregates from the prompt:

| Aggregate                 | File                                      | Notes                                                                                           |
| ------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `Embedding`               | `domain/embedding.ts`                     | Primary entity envelope, tracked through the 9-state Lifecycle.                                 |
| `EmbeddingJob`            | `domain/embedding-job.ts`                 | Schedulable queueing unit; no Registry bucket (Ledger-owned).                                   |
| `EmbeddingSession`        | `domain/embedding-session.ts`             | Exported as `EmbeddingSessionRecord` to avoid a collision with the class of the same spec name. |
| `EmbeddingRequest`        | `domain/embedding-request.ts`             | Text/content REFERENCE + Provider/Model/Namespace/Configuration selection — never actual text.  |
| `EmbeddingResultMetadata` | `domain/embedding-result-metadata.ts`     | Dimension count + provider-reported metadata — NEVER the vector.                                |
| `EmbeddingMetadata`       | `domain/embedding-metadata.ts`            | Descriptive metadata for one Embedding.                                                         |
| `EmbeddingProvider`       | `domain/embedding-provider.ts`            | A registered provider-type record, metadata only.                                               |
| `EmbeddingModel`          | `domain/embedding-model.ts`               | A registered model record, tied to a `providerType`.                                            |
| `EmbeddingVersion`        | `domain/embedding-version.ts`             | Versioning metadata for a Model/Provider pair.                                                  |
| `EmbeddingNamespace`      | `domain/embedding-namespace.ts`           | A logical result partition — never a real index/storage reference.                              |
| `EmbeddingCache`          | `domain/embedding-cache.ts`               | Hit/miss counters + a cache-key REFERENCE — NEVER cached vector data.                           |
| `EmbeddingConfiguration`  | `domain/embedding-configuration.ts`       | Run-tuning metadata; NOT a Registry bucket (resolver-local map — see "Registry").               |
| `EmbeddingStatistics`     | `domain/embedding-statistics-snapshot.ts` | Satisfied via `EmbeddingStatisticsSnapshot`, keyed by `EmbeddingProviderType`.                  |
| `EmbeddingAudit`          | `domain/embedding-audit.ts`               | One immutable entry appended by the Pipeline's Audit stage.                                     |

Supporting (not one of the 14, but required plumbing): `EmbeddingExecution` (the
immutable envelope every stage reads/returns), `EmbeddingRecord` (the read-only view
a caller receives back), `EmbeddingContext` (the caller-scoped execution context).

## Providers (metadata only — 8, never implemented)

`EmbeddingProviderType`: OpenAI, Voyage AI, Cohere, Jina AI, Gemini, Ollama,
FastEmbed, Custom Provider. Zero implementations ship in this package — registering a
Provider only makes it resolvable by the Pipeline's Provider Resolution stage.

## Models (metadata only — 9)

`EmbeddingModelName`: `text-embedding-3-small`, `text-embedding-3-large`,
`voyage-large-2`, `voyage-code-2`, `jina-embeddings`, `gemini-embedding`,
`nomic-embed`, `bge-large`, `custom`. A built-in `EMBEDDING_MODEL_PROVIDER_CATALOG`
maps each Model to its expected `EmbeddingProviderType` (OpenAI's own two models →
OpenAI, Voyage's two → Voyage AI, Jina's → Jina AI, Gemini's → Gemini, `nomic-embed`
→ Ollama, `bge-large` → FastEmbed, `custom` → Custom Provider), used by the
Pipeline's Model Resolution stage for a real compatibility cross-check. `Cohere` has
no catalog entry — a Cohere-backed deployment registers under `custom` +
`Custom Provider` instead, same as any provider without a first-class label.

## Embedding Flow

1. `createEmbedding()` → **Draft**. Builds `Embedding` + `Metadata` + `Request`,
   runs the full Pipeline (Provider/Model/Namespace/Configuration Resolution run on
   EVERY Pipeline call, not only `prepare()` — so the declared Provider/Model must
   already be registered before this call succeeds), registers into the EMBEDDING
   bucket, publishes `EmbeddingCreated`.
2. `queue()` → **Queued**. Publishes `EmbeddingQueued`.
3. `prepare()` → **Preparing**. Re-confirms Provider/Model/Namespace/Configuration
   Resolution against the now-current Registry state.
4. `start()` → **Embedding** (the in-progress state — spelled identically to the
   package's own domain noun; every reference in code/comments disambiguates as
   `EmbeddingState.EMBEDDING`). Publishes `EmbeddingStarted`; if a caller registered
   `provider` via config, invokes `provider.embed()` and records the returned
   `EmbeddingResultMetadata`. No provider means no ResultMetadata — never a default
   "fake embedding" implementation.
5. `complete()` → **Completed**. Publishes `EmbeddingCompleted`.
6. `fail()` → **Failed** (legal from Preparing or Embedding). Publishes `EmbeddingFailed`.
7. `cancel()` → **Cancelled** (legal from every non-terminal, non-settled state).
   Publishes `EmbeddingCancelled`.
8. `archive()` → **Archived** (legal from Completed/Failed/Cancelled). Publishes
   `EmbeddingArchived`.
9. `destroy()` → **Destroyed**, the sole hard-terminal state. Publishes
   `EmbeddingDestroyed`.

`registerProvider()`/`registerModel()`/`registerVersion()` are setup plumbing
**outside** this state-machine-driven flow — they publish `ProviderRegistered`/
`ModelRegistered`/`VersionCreated` respectively but never touch `Embedding.state`.

## Lifecycle

Nine states, in the prompt's own order: `Draft → Queued → Preparing → Embedding →
Completed`, plus `Failed` (reachable from Preparing or Embedding), `Cancelled`
(reachable from every non-terminal, non-settled state), `Archived` (reachable from
every settled outcome — Completed/Failed/Cancelled), and `Destroyed` (the sole
hard-terminal state, reachable from every state including Archived). Unlike
`@aos/knowledge-validator` (005.7M), this Lifecycle has NO separate "Reviewing"
checkpoint — Preparing runs Resolution directly and Embedding is the single
in-flight working state.

`EmbeddingLifecycle.isSettled()` returns `true` for `Completed`, `Failed`,
`Cancelled`, `Archived`, and `Destroyed`; `EmbeddingLifecycle.isTerminal()` returns
`true` only for `Destroyed`. `EmbeddingStateMachine` is the only code allowed to
mutate `Embedding.state` — it stamps `startedAt` on the transition into `Embedding`
and `settledAt` on the transition into any of the 4 settled outcomes.

## Registry

Eight buckets, exactly as named in the prompt: `EMBEDDING`, `PROVIDER`, `MODEL`,
`VERSION`, `NAMESPACE`, `SESSION`, `STATISTICS`, `AUDIT`. `JOB` and `CONFIGURATION`
are NOT Registry buckets — the spec's 8 names do not include them, so Jobs live in a
dedicated `EmbeddingManagerLedger` ledger and Configurations in a dedicated
`EmbeddingResolver` map (mirroring the Policy precedent from
`@aos/knowledge-validator`'s own Resolver — Configuration is commonly a reusable
settings template registered BEFORE the Embedding it will end up attached to even
exists, so it is never cross-checked against a specific `embeddingId`). Every read
is a direct `Map` lookup by id — "Never scan collections." Provider/Model records
are keyed by a deterministic, tenant-scoped composite id
(`buildProviderRegistryId`/`buildModelRegistryId`) built purely from the Request's
declared `providerType`/`modelName` tags, so the Pipeline's Resolution stages never
need to scan for "the Provider of this type."

## Validation

Exactly 12 stages, in this fixed order: **Identity, Metadata, Provider, Model,
Namespace, Configuration, Version, Lifecycle, Dependency, Statistics, Integrity,
Audit** — all pure functions over their input, aggregating every issue without
short-circuiting, with `extraStages` support.

Stages 3–7 (Provider/Model/Namespace/Configuration/Version) are pre-flight
well-formedness checks on the Request's declared FIELDS — they are distinct from the
Pipeline's own Stages 2–5 of the same names, which perform the actual Registry
lookups. The Model stage additionally re-runs the same catalog compatibility
cross-check the Pipeline's Model Resolution stage performs against a RESOLVED
Provider, but against the Request's DECLARED `providerType` — catching a mismatch
before any Registry lookup is even attempted.

## Pipeline

Exactly 10 stages, in this fixed order:

1. **Validation** — runs the entire 12-stage `EmbeddingValidator` aggregator; a
   failure here halts the Pipeline with `EmbeddingCheckException`.
2. **Provider Resolution** — resolves which registered `EmbeddingProvider` handles
   this Request, by tenant-scoped Provider Type. Resolves/validates availability
   only — never calls it.
3. **Model Resolution** — resolves the declared `EmbeddingModel` and cross-checks
   it is compatible with the resolved Provider via the built-in catalog.
4. **Namespace Resolution** — resolves the declared `EmbeddingNamespace`, when one
   was declared.
5. **Configuration Resolution** — resolves the declared `EmbeddingConfiguration`
   from the Resolver's local map, when one was declared.
6. **Metadata** — stamps `updatedAt`.
7. **Metrics** — records the named `Embedding Count` counter and `Provider Usage`.
8. **Lifecycle** — advances the State Machine to `targetState`, when supplied and
   different from the current state.
9. **Audit** — appends an `EmbeddingAudit` entry to the AUDIT bucket.
10. **Logging** — appends one structured, in-memory log entry.

Because Stages 2–5 run on **every** Pipeline call (not only during `prepare()`), the
declared Provider/Model must already be registered before `createEmbedding()` even
succeeds — there is no "draft with an unresolved Provider" state in this design.

This package NEVER invokes an `IEmbeddingProvider` from inside the Pipeline —
provider invocation is a façade-level concern (`EmbeddingManager.start()`), entirely
outside these 10 stages.

## Metrics

Eight named counters (`EmbeddingMetrics`, all real running computations):
`Embedding Count`, `Provider Count`, `Model Count`, `Version Count`,
`Namespace Count`, `Average Duration`, `Cache Metadata Count`, `Provider Usage` (a
per-`EmbeddingProviderType` tally). Plus internal `checkCount`/`checkFailureCount`
bookkeeping that feeds Health/Monitoring without polluting the 8 named metrics.

## Monitoring

`EmbeddingMonitoring.sample()` combines a live `EmbeddingMetrics` snapshot with an
`EmbeddingHealth.check()` report (Registry occupancy + domain failure-ratio, 5
statuses: healthy/warning/degraded/unavailable/unknown) into one
`EmbeddingManagerDashboard`.

## Statistics

`EmbeddingStatistics` tracks `requestedCount`/`completedCount`/`failedCount`/
`cancelledCount`/`lastActivityAt` per `EmbeddingProviderType` — keyed by the
Request's declared Provider Type, mirroring how `@aos/knowledge-validator` keyed its
Statistics by Category.

## Extension Points (interfaces only — never implemented here)

`IEmbeddingProvider`, `IEmbeddingModelProvider`, `IEmbeddingStorageProvider`,
`IEmbeddingCacheProvider`, `IEmbeddingScheduler`, `IEmbeddingAuditProvider`,
`IEmbeddingPublisher`, `IEmbeddingCompressionProvider`,
`IEmbeddingEncryptionProvider`, `IEmbeddingCostProvider`,
`IEmbeddingMetricsProvider`, `IEmbeddingStreamingProvider` — the 12 required
Extension Points, plus 2 Future Readiness contracts
(`IKnowledgeGraphEmbeddingProvider` for 005.7O, `IKnowledgeRecommendationEmbeddingProvider`
for 005.7P). None are implemented in this package; `EmbeddingManagerConfig` registers
NONE by default.

## Events

Eleven events on the `embedding.*` namespace (NOT `knowledge.embedding.*` — this
package drops the "Knowledge" prefix entirely, so `embedding.*` is the more
consistent choice): `embedding.created`, `.queued`, `.started`, `.completed`,
`.cancelled`, `.failed`, `.archived`, `.destroyed`,
`embedding.provider.registered`, `embedding.model.registered`,
`embedding.version.created`. Published via the real `@aos/event-bus` `IPublisher`,
producer `"@aos/embedding-manager"`.

## Token

Prefix `embt_` (EMBedding manager TOken), collision-free with every existing AOS
token prefix (`ptok_`, `stok_`, `ksrc_`, `kver_`, `kpol_`, `kmkt_`, `kgen_`, `kqua_`,
`kval_`).

## Testing

703 tests across 53 spec files. Coverage: 99.44% statements / 98.65% branches / 100%
functions / 99.44% lines (thresholds: ≥95/90/95/95). Run:

```sh
pnpm --filter @aos/embedding-manager test
pnpm --filter @aos/embedding-manager test:coverage
```

See `docs/005.7N-EMBEDDING-MANAGER-REPORT.md` for the full non-obvious design
judgment-call log and the Readiness Checklist handed to 005.7O.
