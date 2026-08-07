# @aos/knowledge-marketplace

The AOS Enterprise Knowledge Marketplace Platform — manages discovery, publishing
metadata, installation metadata, package metadata, dependency metadata, version
compatibility, catalog management, certification metadata, and marketplace lifecycle for
Knowledge Assets inside AOS: marketplace catalog, marketplace package, marketplace
listing, marketplace metadata, marketplace certification, marketplace publisher metadata,
marketplace version metadata, marketplace dependency metadata, marketplace compatibility
metadata, marketplace categories, marketplace tags, marketplace search metadata,
marketplace statistics, marketplace installation metadata **only**. This package
implements no billing, no payments, no revenue sharing, no licensing, no OAuth, no user
accounts, no partner portal, no package download, no package installation, no knowledge
runtime, no AI, no LLM, no workflow, no agent, no memory, and no vector database — this
package **DOES NOT execute knowledge**; it only manages Marketplace metadata. See
`docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md` for the explicit scope boundary and
`docs/005.7J-KNOWLEDGE-MARKETPLACE-REPORT.md` for the readiness checklist handed to the
next Knowledge Generator AI phase.

## Public API

`KnowledgeMarketplace`, `KnowledgeMarketplaceManager`, `KnowledgeMarketplaceRegistry`,
`KnowledgeMarketplaceResolver`, `KnowledgeMarketplaceValidator`,
`KnowledgeMarketplacePipeline`, `KnowledgeMarketplaceMiddleware`,
`KnowledgeMarketplaceFactory`, `KnowledgeMarketplaceContext`, `KnowledgeMarketplaceSession`,
`KnowledgeMarketplaceLifecycle`, `KnowledgeMarketplaceStateMachine`,
`KnowledgeMarketplaceEvents`, `KnowledgeMarketplaceMetrics`, `KnowledgeMarketplaceHealth`,
`KnowledgeMarketplaceMonitoring`, `KnowledgeMarketplaceStatistics`,
`KnowledgeMarketplaceSystem` — the 18 names required by the prompt. `src/index.ts` also
re-exports the full Domain/Contracts/Errors/Validator-stage surface a caller needs to
actually build and use them, matching the curation style established by
`@aos/knowledge-policy`/`@aos/knowledge-versioning`. The prompt's Public API list names
only one `KnowledgeMarketplace`, so the façade takes the bare name and the read-only
per-listing domain view is exported separately as `KnowledgeMarketplaceRecord`.

## Quick example

```ts
import {
  KnowledgeMarketplace,
  MarketplaceCategoryName,
  MarketplaceType,
  MarketplaceCertificationLevel,
  createKnowledgeMarketplaceContext,
} from "@aos/knowledge-marketplace";

const marketplace = new KnowledgeMarketplace(publisher);

marketplace.registerPublisher({
  publisherId: "publisher-1",
  name: "Acme Knowledge Co.",
  marketplaceType: MarketplaceType.CERTIFIED_PARTNER,
});

const context = createKnowledgeMarketplaceContext({
  listingId: "listing-1",
  tenantId: "tenant-1",
});

const created = await marketplace.createListing({
  metadata: marketplace.factory.metadata.create({
    listingId: "listing-1",
    packageId: "package-1",
    title: "Sales Forecasting Knowledge Pack",
    marketplaceType: MarketplaceType.CERTIFIED_PARTNER,
    category: MarketplaceCategoryName.SALES,
    publisherId: "publisher-1",
    tenantId: "tenant-1",
  }),
  context,
  packageName: "Sales Forecasting Knowledge Pack",
  currentVersion: "1.0.0",
});
// created.state === "draft"

await marketplace.submit({ token: created.token });
await marketplace.review({ token: created.token, reviewedBy: "reviewer-1", approved: true });
await marketplace.certify({
  token: created.token,
  certifiedBy: "reviewer-1",
  level: MarketplaceCertificationLevel.STANDARD,
});
const published = await marketplace.publish({ token: created.token });
// published.state === "published"

const results = marketplace.searchMetadata({ keyword: "forecasting" });
```

## Architecture

```
KnowledgeMarketplace (marketplace/) — the public façade, composition root
  owns StateMachine + Pipeline + Middleware + Manager + Resolver + Factory
        │
        ▼
KnowledgeMarketplacePipeline (pipeline/) — 9 fixed stages
  Validation → Metadata Resolution → Dependency Resolution → Compatibility Resolution →
  Category Resolution → Metrics → Lifecycle → Audit → Logging
        │
        ▼
KnowledgeMarketplaceStateMachine — the only code allowed to mutate MarketplaceListing.state
        │
        ▼
KnowledgeMarketplaceResolver — resolve Marketplace/Publisher/Category/Compatibility/
                               Dependency/Listing
        │
        ▼
KnowledgeMarketplaceRegistry (8 generic buckets) + KnowledgeMarketplaceManager
                                                    (token-keyed ledger)
        │
        ▼
KnowledgeMarketplaceMiddleware — marketplace.use() extensibility, separate from the
                                  Pipeline
        │
        ▼
contracts/ — 10 interface-only extension points + 3 future-readiness contracts,
             zero implementations
```

`KnowledgeMarketplace` implements each of the 16 Marketplace Operations (Create
Listing/Update Listing/Submit/Review/Certify/Publish/Deprecate/Suspend/Archive/Remove/Add
Dependency/Remove Dependency/Add Compatibility/Update Metadata/Search Metadata/Browse
Category) as: drive the State Machine to the target state via one atomic 9-stage Pipeline
call → record the relevant domain metadata (dependency/compatibility/category/
certification records as applicable) → update statistics → publish the matching event →
return the updated `KnowledgeMarketplaceRecord`. "Search Metadata"/"Browse Category" are
read-only query operations that delegate directly to the Resolver instead of driving the
State Machine, but still record their named Metrics counters.
`KnowledgeMarketplaceManager` is a distinct, mid-level class — composing `registry` +
`session` + `statistics` + a private token-keyed execution ledger — mirroring
`@aos/knowledge-policy`'s `KnowledgePolicy`/`KnowledgePolicyManager` split and
`@aos/knowledge-versioning`'s equivalent pattern before it. The façade shares its
`statistics` field with the Manager's internal `KnowledgeMarketplaceStatistics` instance
(rather than owning a second, unsynced one) so "listed" bookkeeping (recorded on every
registration) and "published" bookkeeping (recorded by the Publish operation) land in the
same per-category ledger.

## Domain Model

`MarketplacePackage`, `MarketplaceListing`, `MarketplacePublisher`, `MarketplaceCategory`,
`MarketplaceTag`, `MarketplaceCertification`, `MarketplaceCompatibility`,
`MarketplaceDependency`, `MarketplaceVersion`, `MarketplaceStatistics`,
`MarketplaceMetadata`, `MarketplaceInstallationMetadata`, `MarketplaceAudit` — the exact 13
aggregates named by the prompt. `MarketplacePackage`/`MarketplaceListing` are modeled as
genuinely distinct records: `MarketplacePackage` is the underlying software/knowledge unit
(registered once, keyed by `packageId`), and `MarketplaceListing` is its marketplace-facing
presentation (referencing the Package by `packageId`, carrying the `MarketplacePackageStatus`
lifecycle state and the externally addressable `KnowledgeMarketplaceToken`) — matching how
the prompt separates the "Package Registry" and "Listing Registry" buckets.
`MarketplaceInstallationMetadata` is metadata **only** — instructions/requirements as data;
it never downloads, executes, or installs anything. `KnowledgeMarketplaceRecord` is the
concrete, read-only view class implementing the `IKnowledgeMarketplace` domain-model
contract.

## Marketplace Types

The exact 4 types named by the prompt: Official, Certified Partner, Community, Private
Organization (`MarketplaceType`). Metadata only — no authentication.

## Categories

16 built-in category names, per the prompt: General, Marketing, Sales, HR, Finance,
Customer Service, Property, Healthcare, Education, Manufacturing, Automotive, Banking,
Insurance, Government, Software Engineering, Custom (`MarketplaceCategoryName`). The 15
non-`Custom` values always resolve without a registered `MarketplaceCategory` record
(`BUILT_IN_CATEGORY_DEFINITIONS`); `Custom`-named categories must be registered via
`marketplace.registerCategory()` before a Listing may declare them, or Category
Resolution (Validator stage 3, Pipeline stage 5) rejects the operation.

## Package Metadata

`MarketplacePackage` carries `packageId`, `name`, `publisherId`, `marketplaceType`,
`category`, `currentVersion`, and an optional `description` — metadata only, never an
installable artifact reference.

## Compatibility Metadata

The exact 6 fields named by the prompt: AOS Version, Required Packages, Optional
Packages, Required Knowledge Version, Runtime Compatibility, Platform Compatibility
(`MarketplaceCompatibility`). No installation logic — the Pipeline's Compatibility
Resolution stage performs a metadata comparison only, against caller-supplied
`context.metadata.platform`/`context.metadata.runtime` values.

## Dependency Metadata

The exact 4 kinds named by the prompt: Required, Optional, Recommended, Conflicting
(`MarketplaceDependencyKind`). Metadata only — the Pipeline's Dependency Resolution stage
confirms each declared `MarketplaceDependency` is registered in the Dependency Registry
bucket (a presence check, not a version-solving algorithm).

## Lifecycle

9 states, in the prompt's own order: Draft, Submitted, Reviewing, Certified, Published,
Deprecated, Suspended, Archived, Removed. Only `Removed` is hard-terminal (verified by a
dedicated test asserting every non-terminal state has a `Removed` edge, plus an
independently-authored full 9x9 legality matrix test).
`KnowledgeMarketplaceLifecycle` is a read-only, query-only companion
(`states()`/`transitionsFrom()`/`isTerminal()`/`isSettled()`) to the imperative
`KnowledgeMarketplaceStateMachine`, which is the only code allowed to change
`MarketplaceListing.state` — every legal transition appends one immutable history entry
and stamps `publishedAt`/`removedAt` on the corresponding transitions.

## State Machine

`KnowledgeMarketplaceStateMachine.transition()` throws
`IllegalMarketplaceTransitionException` for any edge not present in
`MARKETPLACE_STATE_TRANSITIONS`. The transition table — not specified edge-by-edge in the
prompt — was designed as: `Draft -> Submitted -> Reviewing -> Certified -> Published` is
the mainline publishing path; a `Reviewing` Listing may be sent back to `Draft` on
rejection, as may `Submitted`; a `Published` Listing fans out to
`Deprecated`/`Suspended`/`Archived`; `Suspended` can re-`Publish` or `Archive`;
`Deprecated` can `Archive`; every non-terminal state has a direct edge to `Removed`.

## Registry

One generic `KnowledgeMarketplaceRegistry` class covers the exact 8 required buckets —
Package, Listing, Publisher, Category, Certification, Compatibility, Dependency,
Statistics — as a `Map<Bucket, Map<string, Identified>>`. Never scanned: every read is a
direct Map lookup by id through `KnowledgeMarketplaceResolver`; `list()`/`count()` exist
only for Metrics/Health/Search/Browse sampling. `MarketplacePackage`/`MarketplacePublisher`
records are registered with their bucket key (`id`) set equal to their domain id
(`packageId`/`publisherId`) so lookups never require a collection scan.

## Resolver

`KnowledgeMarketplaceResolver` implements the exact 6 dimensions named by the prompt:
Marketplace (resolves the underlying `MarketplacePackage`), Publisher, Category,
Compatibility, Dependency, Listing — each with a throwing `resolveX()` (raising
`MarketplaceNotFoundException`, or `MarketplaceCategoryException` for an unregistered
`Custom` category) and a non-throwing `tryResolveX()`. `searchListings()`/
`browseCategory()` are additional read-only query helpers on the same class, backing the
"Search Metadata"/"Browse Category" Marketplace Operations.

## Validation

A strict 10-stage validator, in the prompt's own order: Identity, Metadata, Category,
Publisher, Dependency, Compatibility, Version, Certification, Configuration, Integrity.
Every stage runs and its issues are aggregated — no short-circuiting within the
Validator. The Certification stage enforces "a Listing must be Certified before it can be
Published"; the Integrity stage cross-checks the Listing's metadata against its
underlying Package's `packageId`/`marketplaceType`/`category`.

## Pipeline

Exactly 9 fixed stages, per the prompt:

1. **Validation** — the real 10-stage `KnowledgeMarketplaceValidator`, fed
   Publisher/Category-resolvability/known-Package-id facts derived live from the
   Registry → throws `MarketplaceValidationException`.
2. **Metadata Resolution** — normalizes/refreshes `MarketplaceMetadata.updatedAt`.
3. **Dependency Resolution** — confirms every declared `MarketplaceDependency` is
   registered in the Dependency Registry bucket (metadata presence check only).
4. **Compatibility Resolution** — compares a registered `MarketplaceCompatibility`
   record's platform/runtime compatibility lists against caller-supplied
   `context.metadata.platform`/`context.metadata.runtime` (metadata comparison only).
5. **Category Resolution** — resolves/validates the declared Category against the
   Category Registry bucket (built-in categories always resolve; `Custom` requires a
   registered record).
6. **Metrics** — records a Package-Count sample.
7. **Lifecycle** — drives the State Machine to `targetState` (skipped when no
   `targetState` is supplied, or when it already equals the current state).
8. **Audit** — appends a `MarketplaceAuditEntry`.
9. **Logging** — appends a `MarketplaceLogEntry`.

Tracing (stamping a `MarketplaceTrace` with an incrementing `runCount`) also runs
whenever `context.correlationId` is present — every context this package constructs
always has one.

## Metrics

The exact 9 fields named by the prompt: Package Count, Published Count, Certified Count,
Category Count, Dependency Count, Compatibility Count, Publisher Count, Search Count,
Browse Count — plus internal `validationCount`/`validationFailureCount` used only to
derive domain Health, never exposed as a 10th "named" metric.

## Monitoring

`KnowledgeMarketplaceMonitoring.sample()` — exact name `KnowledgeMarketplaceMonitoring`,
per the prompt's Public API list — combines a Metrics snapshot and a Health report into
one `KnowledgeMarketplaceDashboard`, deriving domain health from the
`validationCount`/`validationFailureCount` ratio.

## Health

5 statuses (Healthy/Warning/Degraded/Unavailable/Unknown).
`KnowledgeMarketplaceHealth.check()` derives Registry health from bucket occupancy and
domain health from a caller-reported success/failure ratio.

## Statistics

`KnowledgeMarketplaceStatistics` maintains its own private
`Map<MarketplaceCategoryName, MarketplaceStatisticsSnapshot>` (listedCount/publishedCount/
lastActivityAt) — separate from the Registry's `STATISTICS` bucket, which exists for
callers registering their own externally computed statistics providers.

## Runtime Token

Every Listing has a `KnowledgeMarketplaceToken` (`kmkt_` prefix — collision-free with
every sibling Knowledge package's prefix: `ptok_`, `stok_`, `ksrc_`, `kver_`, `kpol_`).
`KnowledgeMarketplaceManager` looks up executions by token in an internal
`Map<token, KnowledgeMarketplaceExecution>` — never a full-collection scan.

## Extension Points

10 interface-only contracts, zero implementations: `IKnowledgeMarketplaceStorage`,
`IKnowledgeMarketplacePublisher`, `IKnowledgeMarketplaceReviewer`,
`IKnowledgeMarketplaceSearchProvider`, `IKnowledgeMarketplaceInstaller`,
`IKnowledgeMarketplaceLicenseProvider`, `IKnowledgeMarketplaceBillingProvider`,
`IKnowledgeMarketplaceRecommendationProvider`, `IKnowledgeMarketplaceAnalyticsProvider`,
`IKnowledgeMarketplaceApprovalProvider`. Optionally wired via `KnowledgeMarketplaceConfig`;
never required by any Marketplace Operation. 3 additional future-readiness contracts
prepare for downstream phases without implementing them:
`IKnowledgeGeneratorAiMarketplace` (005.7K), `IKnowledgeQualityEngineMarketplace` (005.7L),
`IKnowledgeValidatorAiMarketplace` (005.7M).

## Folder Structure

| Folder           | Contents                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `domain/`        | 13 aggregates + Package Status/Category Name/Marketplace Type/Dependency Kind/Execution types      |
| `contracts/`     | 10 interface-only extension points + 3 future-readiness contracts + validator/operations contracts |
| `errors/`        | `KnowledgeMarketplaceException` + 12 concrete subclasses                                           |
| `context/`       | `KnowledgeMarketplaceContext`, `createKnowledgeMarketplaceContext()`                               |
| `token/`         | `KnowledgeMarketplaceToken` (`kmkt_` prefix)                                                       |
| `session/`       | `KnowledgeMarketplaceSession` — Open/Resume/Close/Cancel/Expire/Renew                              |
| `state-machine/` | `KnowledgeMarketplaceStateMachine` — strict FSM                                                    |
| `lifecycle/`     | `KnowledgeMarketplaceLifecycle` — read-only Lifecycle introspection                                |
| `registry/`      | `KnowledgeMarketplaceRegistry` (8 generic buckets) + `MarketplaceRegistryEntry`                    |
| `resolver/`      | `KnowledgeMarketplaceResolver` — resolve by 6 dimensions + search/browse                           |
| `validator/`     | 10 validator stages + `KnowledgeMarketplaceValidator` aggregator                                   |
| `pipeline/`      | `KnowledgeMarketplacePipeline` — 9-stage fixed sequence                                            |
| `middleware/`    | `KnowledgeMarketplaceMiddleware` — `marketplace.use()` chain                                       |
| `factory/`       | `KnowledgeMarketplaceFactory` + 6 sub-factories                                                    |
| `events/`        | `KnowledgeMarketplaceEvents`, `KnowledgeMarketplaceEventType` (11)                                 |
| `metrics/`       | `KnowledgeMarketplaceMetrics`                                                                      |
| `health/`        | `KnowledgeMarketplaceHealth`                                                                       |
| `monitoring/`    | `KnowledgeMarketplaceMonitoring`                                                                   |
| `statistics/`    | `KnowledgeMarketplaceStatistics`                                                                   |
| `manager/`       | `KnowledgeMarketplaceManager` — the mid-level orchestrator                                         |
| `marketplace/`   | `KnowledgeMarketplace` (façade) — implements all 16 Marketplace Operations                         |
| `bootstrap/`     | `KnowledgeMarketplaceSystem` — implements `@aos/runtime-kernel`'s `IModule`                        |
| `config/`        | `KnowledgeMarketplaceConfig`                                                                       |

## Event Bus namespace

`knowledge.marketplace.created`, `knowledge.marketplace.listing.created`, `.updated`,
`.submitted`, `.reviewed`, `.certified`, `.published`, `.deprecated`, `.suspended`,
`.archived`, `.removed` — the exact 11 events, published via the real `@aos/event-bus`
`IPublisher`.

## Known Limitations

- **All 10 named extension-point contracts have zero implementations** — by design. No
  real durable storage, no real reviewer/search/installer/license/billing/recommendation/
  analytics/approval integration exists anywhere in this package; they are invoked only
  when a caller supplies one via `KnowledgeMarketplaceConfig` — this package never does so
  itself.
- **`review()` only records the reviewer's decision as a reason string and transitions
  Submitted -> Reviewing** — it does not itself branch into a rejection path back to
  Draft; a caller wishing to model rejection calls `updateListing()`/`submit()` again
  after inspecting `approved`. This keeps every Marketplace Operation as a single,
  deterministic state transition (see "Non-obvious design/judgment calls" in the report).
- **`KnowledgeMarketplaceResolver` ships zero registered Packages/Publishers** — a caller
  must `registerPublisher()`/`createListing()` at least once before any `resolve*()` call
  can return results.
- **`KnowledgeMarketplaceSession` is a separate access-window ledger from the Marketplace
  Lifecycle State Machine** — the two are not automatically kept in sync.
- **No billing, payments, revenue sharing, or licensing enforcement** — `MarketplaceType`
  and the license/billing Extension Points are metadata-only; no money ever moves.

## Dependency Rules

Allowed: `@aos/kernel`/`@aos/runtime-kernel`, `@aos/shared`/`@aos/common`,
`@aos/events`/`@aos/event-bus`. Read contracts only from `@aos/knowledge-engine`,
`@aos/knowledge-versioning`, `@aos/knowledge-policy` — this package never instantiates
another runtime; in this phase it also never imports a concrete class from those three
packages (see the report's "Dependency mapping" judgment call).

## Persistence

None. `KnowledgeMarketplaceRegistry`/`KnowledgeMarketplaceSession`/
`KnowledgeMarketplaceManager`'s execution ledger are in-memory only.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.7J-KNOWLEDGE-MARKETPLACE-REPORT.md` for coverage numbers, known limitations, and
the readiness checklist for the next Knowledge Generator AI phase — **not implemented in
this package**.
