# @aos/knowledge-source-manager

The AOS Enterprise Knowledge Source Manager — manages the **actual, tenant-configured
Knowledge Source instances** built on top of a registered `@aos/knowledge-provider`
definition. **Knowledge Provider defines WHAT a provider is. Knowledge Source Manager
manages ACTUAL configured sources owned by tenants.** A Provider (Google Drive, Notion,
GitHub, ...) may have unlimited Sources — "Marketing SOP", "Product Catalog", "HR
Documents" — each independently registered, configured, scheduled (metadata only), and
governed. This package implements no OAuth, no secrets, no connector SDKs, no Google
Drive/Notion/SharePoint/GitHub SDKs, no synchronization, no retrieval, no indexing, no
embedding, no memory, no AI, and no provider-specific logic. See
`docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md` for the explicit scope boundary and
`docs/005.7G-KNOWLEDGE-SOURCE-MANAGER-REPORT.md` for the readiness checklist handed to
the next Knowledge Versioning phase.

## Public API

`KnowledgeSourceManager`, `KnowledgeSourceManagerSystem`, `KnowledgeSource`,
`KnowledgeSourceRegistry`, `KnowledgeSourceResolver`, `KnowledgeSourceFactory`,
`KnowledgeSourceContext`, `KnowledgeSourceSession`, `KnowledgeSourceValidator`,
`KnowledgeSourcePipeline`, `KnowledgeSourceLifecycle`, `KnowledgeSourceStateMachine`,
`KnowledgeSourceMetrics`, `KnowledgeSourceHealth`, `KnowledgeSourceMonitor`,
`KnowledgeSourceEvents`, `KnowledgeSourceStatistics`, `KnowledgeSourceConfiguration`,
`KnowledgeSourcePolicy`, `KnowledgeSourcePermission`, `KnowledgeSourceScheduler`,
`KnowledgeSourceCatalog` — the 22 names required by the source prompt. `src/index.ts`
also re-exports the Domain/Contracts/Errors/Validator-stage/Factory-sub-class surface a
caller needs to actually build and use them.

## Quick example

```ts
import {
  KnowledgeSourceManager,
  KnowledgeSourceCategory,
  KnowledgeSourceEvents,
  KnowledgeSourceScheduleMode,
  createKnowledgeSourceContext,
} from "@aos/knowledge-source-manager";

const manager = new KnowledgeSourceManager({ events: new KnowledgeSourceEvents(publisher) });

const metadata = manager.factory.metadata.create({
  sourceId: "marketing-sop",
  sourceName: "Marketing SOP",
  sourceCategory: KnowledgeSourceCategory.DOCUMENT,
  sourceProvider: "Google Drive",
  providerId: "google-drive",
  tenantId: "tenant-1",
});

const configuration = manager.factory.configuration.create({
  sourceId: "marketing-sop",
  enabled: true,
  syncMode: KnowledgeSourceScheduleMode.MANUAL,
});

const context = createKnowledgeSourceContext({
  sourceId: "marketing-sop",
  providerId: "google-drive",
  tenantId: "tenant-1",
});

const source = await manager.create(metadata, configuration, context);
// source.state — Enabled once Validation/Configuration/Policy/Permission/
// Provider Resolution/Registration/Catalog/Metrics/Events all succeed
```

## Architecture

```
Google Drive Provider / Notion Provider / GitHub Provider / Database Provider
(@aos/knowledge-provider — WHAT a provider is; referenced only by providerId)
        │
        ▼
KnowledgeSourceManager (manager/) — the public façade, composition root
  directly drives the Source Lifecycle State Machine around one Pipeline call
        │
        ▼
KnowledgeSourcePipeline (pipeline/) — 9 fixed stages
  Validation → Configuration → Policy → Permission → Provider Resolution →
  Registration → Catalog → Metrics → Events
        │
        ▼
KnowledgeSourceResolver — resolve by Source Id/Provider/Category/Workspace/Tenant/
                           Namespace/Collection/Policy/Permission/Metadata/Priority
        │
        ▼
KnowledgeSourceCatalog — Provider/Namespace/Collection/Workspace/Tenant Mapping
        │
        ▼
KnowledgeSourceRegistry (9 generic buckets) + KnowledgeSourceSession + KnowledgeSourceStatistics
        │
        ▼
KnowledgeSourceMiddlewarePipeline — source.use() extensibility, not auto-run
        │
        ▼
contracts/ — 13 interface-only extension points, zero implementations
```

`KnowledgeSourceManager.create()` drives the State Machine directly around one atomic
`KnowledgeSourcePipeline.run()` call — there is no separate registrar/verb class or
mid-level orchestrator, since the source prompt's 22-name Public API list carries no
distinct name for one (unlike `@aos/knowledge-provider`, which split this responsibility
between `KnowledgeProvider` and `KnowledgeProviderManager`).

## Source Model

Every configured Source is a `KnowledgeSource` — a read-only view over one
`KnowledgeSourceExecution` (`instance` + `context` + `metadata` + `configuration` +
`history`) — distinct from `KnowledgeSourceManager` (the orchestrating façade; the
prompt's Public API list names both). Every Source carries one
`KnowledgeSourceMetadataRecord` (the exact 24-field Zod schema: SourceId, SourceName,
SourceDescription, SourceCategory, SourceProvider, ProviderId, ProviderVersion,
Namespace, Collection, WorkspaceId, TenantId, OrganizationId, DepartmentId, Labels, Tags,
Priority, Policy, Permission, Environment, Owner, CreatedBy, UpdatedBy, CreatedAt,
UpdatedAt) and one `KnowledgeSourceContext` (14 fields: ExecutionToken, SourceId,
ProviderId, WorkspaceId, TenantId, OrganizationId, DepartmentId, Environment, Namespace,
Policy, Permission, Metadata, TraceId, CorrelationId). `SourceProvider` and `ProviderId`
are deliberately distinct: `SourceProvider` is the human-readable provider label (e.g.
"Google Drive"), `ProviderId` is the canonical identifier of the registered
`@aos/knowledge-provider` definition.

`KnowledgeSourceCategory` covers the 12 required buckets — Document, Repository, CMS,
Storage, Database, API, CRM, ERP, Filesystem, Cloud, Knowledge, Custom.

## Catalog

`KnowledgeSourceCatalog` is a derived, secondary index over whatever Sources are
registered in `KnowledgeSourceRegistry`'s `SOURCE` bucket — not a store of its own record
of truth. It maintains the Source Catalog (flat `sourceId -> metadata` lookup) plus 5
Id-set mappings — Provider Mapping, Namespace Mapping, Collection Mapping, Workspace
Mapping, Tenant Mapping — kept in sync by the Pipeline's Catalog stage (stage 7) on every
registration/removal.

## Registry

One generic `KnowledgeSourceRegistry` class covers all 9 required buckets — Source,
Category, Namespace, Collection, Policy, Permission, Statistics, Session, Health — as a
`Map<Bucket, Map<string, Identified>>`. The Pipeline's Registration stage (stage 6) stores
a combined `SourceRegistryEntry` (`id` + `metadata` + `configuration`) in the `SOURCE`
bucket so the Metrics stage can derive Sync Enabled Count / Schedule Count by scanning
that one bucket. `KnowledgeSourceStatistics` owns its own private per-Category counter
map rather than the `STATISTICS` bucket — that bucket is for callers registering their
own externally computed statistics providers.

## Pipeline

9 fixed stages, no short-circuiting on non-fatal issues within a stage, but a hard throw
on the first stage that fails: Validation → Configuration → Policy → Permission →
Provider Resolution → Registration → Catalog → Metrics → Events. Provider Resolution
(stage 5) is optional and interface-only (`IKnowledgeSourceProviderResolver`) — this
package never imports `@aos/knowledge-provider` at runtime; when no resolver is supplied
the stage is a no-op pass-through. Unlike `@aos/knowledge-provider`'s Pipeline, no
"failed" event is published on error — the Source Lifecycle has no Failed state and the
Events list has no matching event type, so a stage exception simply propagates.

## Lifecycle

12 states: Created, Registered, Configured, Validated, Enabled, Disabled, Scheduled,
Synchronizing, Paused, Archived, Deleted, Destroyed. Only `Destroyed` is hard-terminal;
Disabled/Archived/Deleted/Destroyed are "settled". `create()` drives Created → Registered
→ Configured → Validated in rapid succession once the atomic Pipeline call succeeds, then
onward to Enabled when the supplied Configuration's `enabled` flag is `true`.
`enable()`/`disable()`, `archive()`, and `remove()` (Deleted → Destroyed) are explicit
imperative operations a caller invokes afterward, each publishing its matching event.
`KnowledgeSourceLifecycle` is a read-only, query-only companion
(`states()`/`transitionsFrom()`/`isTerminal()`/`isSettled()`).

## Configuration

"Metadata only. No OAuth. No Secret. No API Client." Support: Schedule, Namespace,
Collection, Policy, Permission, Priority, Sync Mode, Enabled, Auto Sync, Incremental,
Versioning, Retention. `KnowledgeSourceConfiguration.assertValid()` is a real, enforced
runtime guard: Auto Sync requires Enabled; a Sync Mode of Cron/Interval/One Time/Future
Event requires a matching, structurally valid Schedule descriptor (delegated to
`KnowledgeSourceScheduler`); `assertValidExtraSettings()` rejects any free-form settings
key that looks like a credential.

## Policy

`KnowledgeSourcePolicy` evaluates every enabled, scope-matching registered
`KnowledgeSourcePolicyRecord` against a Source's `sourceCategory`
(`allowedCategories`/`deniedCategories`) — real, non-stub evaluation logic. This is the
coarse "may Sources of this Category exist for this tenant/workspace" gate.

## Permission

`KnowledgeSourcePermission` is a distinct, real, grant-based evaluator — not a trivial
delegation to Policy. It evaluates fine-grained tenant/workspace/role-scoped
allow/deny `KnowledgeSourcePermissionGrant`s against a specific Source's
`namespace`/`sourceCategory` — "deny always wins", permissive by default when no grant
matches a Context's scope at all.

## Scheduler

`KnowledgeSourceScheduler` — "Metadata only." Supports Manual, Cron, Interval, One Time,
Future Event. Validates that the field a given mode requires is present (Cron requires
`cronExpression`, Interval requires `intervalMs`, One Time requires `runAt`, Future Event
requires `eventName`) and throws `SourceScheduleException` otherwise — never touches a
real timer or cron library.

## Provider Resolver

"Resolve by Source Id, Provider, Category, Workspace, Tenant, Namespace, Collection,
Policy, Permission, Metadata, Priority." `KnowledgeSourceResolver` reads
`KnowledgeSourceCatalog`'s indexes; owns no Source implementation itself.

## Middleware Pipeline

`KnowledgeSourceMiddlewarePipeline` — a Koa-style chain a caller extends via
`manager.use(middleware)`. The 7 named built-in slots (Validation/Permission/Policy/
Tracing/Metrics/Lifecycle/Logging) are pass-through hook points; this package registers
no real tracing/logging/telemetry behavior itself, only the extensibility mechanism.

## Metrics

```
KnowledgeSourceMetrics
├── sourceCount / providerCount
├── workspaceCount / tenantCount
├── namespaceCount / collectionCount
├── syncEnabledCount / scheduleCount
└── policyCount / permissionCount
```

## Health

5 statuses (Healthy/Warning/Degraded/Unavailable/Unknown).
`KnowledgeSourceHealth.check()` derives Registry health from whether anything is
registered across all 9 buckets, and Catalog health from whether the Catalog holds any
entries.

## Monitoring

`KnowledgeSourceMonitor.sample()` combines a Metrics snapshot and a Health report into one
`KnowledgeSourceDashboard` carrying all 8 named sections: Source, Workspace, Tenant,
Namespace, Collection, Provider, Health, Usage.

## Runtime Token

Every Source has a `KnowledgeSourceToken` (`ksrc_` prefix — a fresh short prefix, chosen
because `@aos/knowledge-synchronization` already owns `stok_` and
`@aos/knowledge-provider` already owns `ptok_`). `KnowledgeSourceManager`'s
`getExecution()`/`requireExecution()`/`get()` always look up by token in an internal
`Map<token, KnowledgeSourceExecution>` — never a full-collection scan.

## Folder Structure

| Folder           | Contents                                                                      |
| ---------------- | ----------------------------------------------------------------------------- |
| `domain/`        | Lifecycle State/Category/Instance/History/Statistics Snapshot types           |
| `contracts/`     | 13 interface-only extension points + 1 extra Provider Resolver contract       |
| `errors/`        | `KnowledgeSourceException` + 13 concrete subclasses                           |
| `context/`       | `KnowledgeSourceContext`, `createKnowledgeSourceContext()`                    |
| `token/`         | `KnowledgeSourceToken` (`ksrc_` prefix)                                       |
| `session/`       | `KnowledgeSourceSession` — Open/Resume/Close/Cancel/Expire/Renew              |
| `state-machine/` | `KnowledgeSourceStateMachine` — strict FSM                                    |
| `lifecycle/`     | `KnowledgeSourceLifecycle` — read-only Lifecycle introspection                |
| `registry/`      | `KnowledgeSourceRegistry` (9 generic buckets) + `SourceRegistryEntry`         |
| `catalog/`       | `KnowledgeSourceCatalog` — 5 secondary Id-set mapping dimensions              |
| `resolver/`      | `KnowledgeSourceResolver` — resolve by 11 dimensions                          |
| `validator/`     | 7 validator stages + `KnowledgeSourceValidator` aggregator                    |
| `configuration/` | `KnowledgeSourceConfiguration` — real enforced runtime guard                  |
| `policy/`        | `KnowledgeSourcePolicy`                                                       |
| `permission/`    | `KnowledgeSourcePermission` — real grant-based evaluator                      |
| `scheduler/`     | `KnowledgeSourceScheduler` — metadata-only Schedule validation                |
| `pipeline/`      | `KnowledgeSourcePipeline` — 9-stage fixed sequence                            |
| `middleware/`    | `KnowledgeSourceMiddlewarePipeline` — `manager.use()` chain                   |
| `factory/`       | `KnowledgeSourceFactory` + 5 sub-factories                                    |
| `events/`        | `KnowledgeSourceEvents`, `KnowledgeSourceEventType` (9)                       |
| `metrics/`       | `KnowledgeSourceMetrics`                                                      |
| `health/`        | `KnowledgeSourceHealth`                                                       |
| `monitoring/`    | `KnowledgeSourceMonitor`                                                      |
| `statistics/`    | `KnowledgeSourceStatistics`                                                   |
| `source/`        | `KnowledgeSource` — the read-only Source view class                           |
| `manager/`       | `KnowledgeSourceManager` — the public façade                                  |
| `bootstrap/`     | `KnowledgeSourceManagerSystem` — implements `@aos/runtime-kernel`'s `IModule` |
| `config/`        | `KnowledgeSourceManagerConfig`                                                |

## Event Bus namespace

`knowledge.source.created`, `.updated`, `.deleted`, `.enabled`, `.disabled`,
`.registered`, `.archived`, `.metrics.updated`, `.health.changed` — every one published
via the real `@aos/event-bus` `IPublisher`.

## Known Limitations

- **All 13 named extension-point contracts (plus the extra
  `IKnowledgeSourceProviderResolver`) have zero implementations** — by design.
- **`KnowledgeSourceResolver`/`KnowledgeSourceCatalog` ship zero registered Sources** — a
  caller must create at least one Source before any `resolveBy*()` call can return
  results.
- **`knowledge.source.updated`/`.metrics.updated`/`.health.changed` are declared but
  never published by anything in this package** — no scheduled Metrics/Health-diffing
  sampler exists here.
- **`KnowledgeSourceSession` is a separate access-window ledger from the Source Lifecycle
  State Machine** — the two are not automatically kept in sync.
- **Provider Resolution (Pipeline stage 5) is a no-op unless a caller supplies an
  `IKnowledgeSourceProviderResolver`** — this package never imports
  `@aos/knowledge-provider` to keep the dependency vendor-neutral, per the prompt's
  "Only interface references" instruction.

## Dependency Rules

Allowed: `@aos/runtime-kernel`, `@aos/registry`, `@aos/event-bus`, `@aos/scheduler`,
`@aos/knowledge-provider`, `@aos/knowledge-synchronization`, `@aos/knowledge-engine`,
`@aos/knowledge-runtime`. Forbidden: `connector-runtime`, `oauth`, `secret-manager`,
`tool-runtime`, `memory`, `ai-gateway`, `agent-runtime`. Only interface references — this
package does not actually import any of the allowed Knowledge packages at runtime, since
Source registration/resolution is entirely self-contained metadata bookkeeping (mirroring
`@aos/knowledge-provider`'s own precedent).

## Persistence

None. `KnowledgeSourceRegistry`/`KnowledgeSourceCatalog`/`KnowledgeSourceSession`/
`KnowledgeSourceManager`'s execution ledger are in-memory only.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.7G-KNOWLEDGE-SOURCE-MANAGER-REPORT.md` for coverage numbers, known limitations,
and the readiness checklist for the next Knowledge Versioning phase — **not implemented
in this package**.
