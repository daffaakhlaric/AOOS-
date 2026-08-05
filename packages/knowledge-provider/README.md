# @aos/knowledge-provider

The AOS Enterprise Knowledge Provider framework — the vendor-neutral abstraction layer
between the Enterprise Knowledge Platform and every external knowledge source. **Every
future connector exposes knowledge through a Provider registered here. Knowledge Engine
must never know Google Drive. Knowledge Runtime must never know Notion. Knowledge
Retrieval must never know GitHub. Knowledge Synchronization must never know
SharePoint.** This package implements no OAuth, no API clients, no connector SDKs, no
database drivers, no synchronization, no retrieval, no embedding, no memory, no LLM, and
no provider-specific logic. See `docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md` for the
explicit scope boundary and `docs/005.7F-KNOWLEDGE-PROVIDER-REPORT.md` for the readiness
checklist handed to the next Knowledge Source Manager phase.

## Public API

`KnowledgeProvider`, `KnowledgeProviderSystem`, `KnowledgeProviderRegistry`,
`KnowledgeProviderResolver`, `KnowledgeProviderManager`, `KnowledgeProviderFactory`,
`KnowledgeProviderContext`, `KnowledgeProviderSession`, `KnowledgeProviderValidator`,
`KnowledgeProviderPipeline`, `KnowledgeProviderLifecycle`, `KnowledgeProviderStateMachine`,
`KnowledgeProviderMetrics`, `KnowledgeProviderHealth`, `KnowledgeProviderMonitor`,
`KnowledgeProviderEvents`, `KnowledgeProviderStatistics`, `KnowledgeProviderCapabilities`,
`KnowledgeProviderMetadata`, `KnowledgeProviderPolicy`, `KnowledgeProviderConfiguration`
— the 21 names required by the source prompt. `src/index.ts` also re-exports the
Domain/Contracts/Errors/Validator-stage/Factory-sub-class/Built-in-Definitions surface a
caller needs to actually build and use them.

## Quick example

```ts
import {
  KnowledgeProvider,
  KnowledgeProviderCapabilityFlag,
  KnowledgeProviderCategory,
  KnowledgeProviderEvents,
  KnowledgeProviderStatus,
  createKnowledgeProviderContext,
} from "@aos/knowledge-provider";

const provider = new KnowledgeProvider({ events: new KnowledgeProviderEvents(publisher) });

// A caller implements IKnowledgeProvider for the external system it connects — this
// package ships zero connector implementations, only the abstraction.
const googleDriveConnector = {
  id: "google-drive",
  category: KnowledgeProviderCategory.STORAGE,
  capabilities: [KnowledgeProviderCapabilityFlag.SUPPORTS_READ],
};

const metadata = provider.factory.metadata.create({
  providerId: "google-drive",
  providerName: "Google Drive",
  providerVersion: "1.0.0",
  providerCategory: KnowledgeProviderCategory.STORAGE,
  providerCapabilities: [KnowledgeProviderCapabilityFlag.SUPPORTS_READ],
  providerStatus: KnowledgeProviderStatus.ACTIVE,
});

const context = createKnowledgeProviderContext({
  tenantId: "tenant-1",
  providerId: "google-drive",
  providerType: KnowledgeProviderCategory.STORAGE,
});

const execution = await provider.register(googleDriveConnector, metadata, context);
// execution.instance.state — READY once Validation/Capability Resolution/Configuration/
// Policy/Permission/Provider Resolution/Metadata/Metrics/Events all succeed
```

## Architecture

```
Google Drive / Notion / GitHub / Database / SharePoint Connectors
(each implements IKnowledgeProvider — none of this package's business)
        │
        ▼
KnowledgeProvider (provider/) — the public façade
        │
        ▼
KnowledgeProviderPipeline (pipeline/)
  Validation → Capability Resolution → Configuration → Policy → Permission →
  Provider Resolution → Metadata → Metrics → Events
        │
        ▼
KnowledgeProviderResolver — resolve by Type/Category/Capability/Namespace/Source/
                             Priority/Metadata
        │
        ▼
KnowledgeProviderPolicy — Policy evaluation (allowedCategories/deniedCategories)
        │
        ▼
KnowledgeProviderManager
  ├── KnowledgeProviderRegistry   (8 buckets)
  ├── KnowledgeProviderSession    (Open/Resume/Close/Cancel/Expire/Renew)
  └── KnowledgeProviderStatistics (per-Category counters)
        │
        ▼
KnowledgeProviderMiddlewarePipeline — provider.use() extensibility hook
        │
        ▼
contracts/ — 14 interface-only extension points, zero implementations
        │
        ▼
definitions/ — 28 built-in Provider metadata catalog entries, zero implementations
```

`KnowledgeProvider` is the composition root and this package's public façade, driving
the Provider Lifecycle State Machine directly around one Pipeline call per registration
— there is no separate "verb" class, since the source prompt's Public API list has no
distinct registrar name.

## Provider Lifecycle

10 states: Registered, Validated, Configured, Connected, Ready, Synchronizing,
Disconnected, Disabled, Failed, Destroyed. Only `Destroyed` is hard-terminal (no outgoing
edges) — Disconnected/Disabled/Failed are "settled" but can still transition to
Destroyed. `register()` drives Registered → Validated → Configured → Connected → Ready in
rapid succession once the atomic Pipeline call succeeds; `disable()`/`enable()`,
`disconnect()`/`reconnect()`, and `destroy()` are explicit imperative operations a caller
invokes afterward.

## Pipeline

9 stages, in fixed order: Validation → Capability Resolution → Configuration → Policy →
Permission → Provider Resolution → Metadata → Metrics → Events. Only the two stages this
Pipeline can fully attribute publish events themselves (`UPDATED` after the Metadata
stage, `FAILED` on any stage exception) — Provider Lifecycle events
(Registered/Enabled/Disabled/Connected/Disconnected) are published by the outer
`KnowledgeProvider` façade, which owns the State Machine transitions they describe.

## Registry

One generic class covering all 8 buckets the source prompt requires (Providers/
Capabilities/Metadata/Categories/Policies/Sessions/Health/Statistics).
`KnowledgeProviderStatistics` owns its own private per-Category map rather than the
`STATISTICS` bucket — that bucket is for callers registering their own externally
computed statistics providers.

## Capability Resolution

`KnowledgeProviderCapabilities` — "SupportsRead ... SupportsRelationship" (20 flags) — a
read-only, queryable wrapper (`has()`/`hasAll()`/`hasAny()`/`list()`) the Pipeline's
Capability Resolution stage builds from a Provider's declared `providerCapabilities`, and
`KnowledgeProviderResolver.resolveByCapability()` uses to filter registered Providers.

## Metadata

`KnowledgeProviderMetadata` — register/read access over the Registry's `METADATA` bucket,
keyed by `ProviderMetadataRecord.providerId`, with the exact 18-field prompt list
(ProviderId/ProviderName/ProviderVersion/ProviderCategory/ProviderAuthor/
ProviderDescription/ProviderCapabilities/ProviderConfiguration/ProviderStatus/
ProviderPriority/ProviderPolicy/ProviderNamespace/ProviderIcon/ProviderTags/
ProviderLabels/ProviderDependencies/ProviderLicense/ProviderHomepage).

## Configuration

"Configuration model only. NO OAuth. NO Secrets. NO API Clients. Only metadata."
`KnowledgeProviderConfiguration.validate()`/`assertValid()` reject any configuration key
that looks like a credential (`secret`/`password`/`token`/`apiKey`/`credential`/`oauth`,
case-insensitive) — a real, enforced guard wired into both the standalone
`ConfigurationValidator` stage and the Pipeline's Configuration stage.

## Policy

`KnowledgeProviderPolicy` evaluates every enabled, scope-matching registered
`KnowledgeProviderPolicyRecord` against a Provider's `providerCategory`
(`allowedCategories`/`deniedCategories`) — real, non-stub evaluation logic mirroring
`@aos/knowledge-synchronization`'s `KnowledgeSynchronizationPolicy`.

## Provider Resolver

"Resolve provider by Type, Category, Capability, Namespace, Source, Priority, Metadata."
`KnowledgeProviderResolver` reads the Registry's `PROVIDER`/`METADATA` buckets; owns no
provider implementation itself. `resolveBySource()` is a documented alias of
`resolveById()`.

## Built-in Provider Definitions

28 metadata-only catalog entries (`BUILT_IN_PROVIDER_DEFINITIONS`) — Google Drive,
Notion, Confluence, SharePoint, GitHub, GitLab, Dropbox, OneDrive, Amazon S3, Azure Blob,
Local Folder, FTP, SFTP, REST API, GraphQL, PostgreSQL, MySQL, SQL Server, Oracle,
MongoDB, Redis, Elasticsearch, OpenSearch, Salesforce, HubSpot, SAP, Dynamics, Custom
Provider. Each carries only `id`/`name`/`category`/`defaultCapabilities`/`description` —
**no implementation of any kind**.

## Middleware Pipeline

`KnowledgeProviderMiddlewarePipeline` — a Koa-style chain a caller extends via
`provider.use(middleware)`. The 7 named built-in slots (Validation/Permission/Policy/
Tracing/Metrics/Lifecycle/Logging) are pass-through hook points; this package registers
no real tracing/logging/telemetry behavior itself, only the extensibility mechanism.

## Metrics

```
KnowledgeProviderMetrics
├── providerCount / providerUsage / providerCategory
├── capabilityUsage
├── workspaceUsage / tenantUsage
├── failureCount / healthCount
└── registrationCount
```

## Health

5 statuses (Healthy/Warning/Degraded/Unavailable/Unknown).
`KnowledgeProviderHealth.check()` derives Registry health from whether anything is
registered across all 8 buckets, and Provider health from the live
`failureCount/registrationCount` ratio.

## Monitoring

`KnowledgeProviderMonitor.sample()` combines a Metrics snapshot and a Health report into
one `KnowledgeProviderDashboard` carrying all 7 named sections (Provider/Capability/
Health/Workspace/Tenant/Category/Usage).

## Folder Structure

| Folder           | Contents                                                                  |
| ---------------- | ------------------------------------------------------------------------- |
| `domain/`        | Lifecycle State/Category/Capability Flag/Status/Metadata Record types     |
| `contracts/`     | 14 interface-only extension points                                        |
| `errors/`        | `KnowledgeProviderException` + 12 concrete subclasses                     |
| `context/`       | `KnowledgeProviderContext`, `createKnowledgeProviderContext()`            |
| `token/`         | `KnowledgeProviderToken` (`ptok_` prefix)                                 |
| `session/`       | `KnowledgeProviderSession` — Open/Resume/Close/Cancel/Expire/Renew        |
| `state-machine/` | `KnowledgeProviderStateMachine` — strict FSM                              |
| `lifecycle/`     | `KnowledgeProviderLifecycle` — read-only Lifecycle introspection          |
| `registry/`      | `KnowledgeProviderRegistry` (8 generic buckets)                           |
| `resolver/`      | `KnowledgeProviderResolver` — resolve by 7 dimensions                     |
| `validator/`     | 8 validator stages + `KnowledgeProviderValidator` aggregator              |
| `capabilities/`  | `KnowledgeProviderCapabilities`                                           |
| `metadata/`      | `KnowledgeProviderMetadata`                                               |
| `policy/`        | `KnowledgeProviderPolicy`                                                 |
| `configuration/` | `KnowledgeProviderConfiguration` — secret-key rejection                   |
| `permission/`    | `IProviderPermissionChecker` — query-level permission gate                |
| `pipeline/`      | `KnowledgeProviderPipeline` — 9-stage fixed sequence                      |
| `middleware/`    | `KnowledgeProviderMiddlewarePipeline` — `provider.use()` chain            |
| `factory/`       | `KnowledgeProviderFactory` + 5 sub-factories                              |
| `events/`        | `KnowledgeProviderEvents`, `KnowledgeProviderEventType` (9)               |
| `metrics/`       | `KnowledgeProviderMetrics`                                                |
| `health/`        | `KnowledgeProviderHealth`                                                 |
| `monitoring/`    | `KnowledgeProviderMonitor`                                                |
| `statistics/`    | `KnowledgeProviderStatistics`                                             |
| `definitions/`   | `BUILT_IN_PROVIDER_DEFINITIONS` — 28 metadata-only catalog entries        |
| `manager/`       | `KnowledgeProviderManager` — Registry + Session + Statistics orchestrator |
| `provider/`      | `KnowledgeProvider` — the public façade                                   |
| `bootstrap/`     | `KnowledgeProviderSystem` — implements `@aos/runtime-kernel`'s `IModule`  |
| `config/`        | `KnowledgeProviderConfig`                                                 |

## Event Bus namespace

`knowledge.provider.registered`, `.updated`, `.enabled`, `.disabled`, `.connected`,
`.disconnected`, `.failed`, `.metrics.updated`, `.health.changed` — every one published
via the real `@aos/event-bus` `IPublisher`.

## Known Limitations

- **All 14 extension-point contracts have zero implementations** — by design.
- **`KnowledgeProviderResolver` ships zero registered Providers** — a caller must
  register at least one Provider before `register()` can resolve anything.
- **`knowledge.provider.metrics.updated`/`.health.changed` are declared but never
  published** — no scheduled Metrics/Health-diffing sampler exists in this package.
- **`KnowledgeProviderSession` is a separate access-window ledger from the Provider
  Lifecycle State Machine** — the two are not automatically kept in sync.
- **The 28 Built-in Provider Definitions are metadata only** — registering the matching
  `IKnowledgeProvider` connector for any of them is entirely a future (005.7G+)
  responsibility.

## Dependency Rules

Allowed: `@aos/runtime-kernel`, `@aos/registry`, `@aos/event-bus`, `@aos/scheduler`,
`@aos/knowledge-engine`, `@aos/knowledge-runtime`, `@aos/knowledge-indexing`,
`@aos/knowledge-retrieval`, `@aos/knowledge-synchronization`. Forbidden:
`connector-runtime`, OAuth/secret-manager packages, `@aos/tool-runtime`, `@aos/memory`,
`@aos/agent-runtime`, `@aos/ai-gateway`. Only interface references — this package does
not actually import any of the allowed Knowledge packages at runtime, since Provider
registration/resolution is entirely self-contained metadata/capability bookkeeping.

## Persistence

None. `KnowledgeProviderRegistry`/`KnowledgeProviderSession`/`KnowledgeProviderManager`'s
execution ledger are in-memory only.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.7F-KNOWLEDGE-PROVIDER-REPORT.md` for coverage numbers, known limitations, and
the readiness checklist for the next Knowledge Source Manager phase — **not implemented
in this package**.
