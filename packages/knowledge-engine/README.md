# @aos/knowledge-engine

The AOS Enterprise Knowledge Engine — the canonical Knowledge Domain every future AOS
module (Workflow, Memory, Agent, Prompt, Capability, Connector, AI Gateway, Experience
Layer, Marketplace) will consume knowledge through. **This package implements no
retrieval, embeddings, RAG, indexing, vector search, synchronization, or LLM
operations.** It only defines domain aggregates, lifecycle, relationships, policy,
permissions, versioning, templates, metadata, and the extension-point contracts later
packages implement. See `docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md` for the explicit scope
boundary and `docs/005.7A-KNOWLEDGE-ENGINE-REPORT.md` for the readiness checklist handed
to 005.7B (Knowledge Runtime).

## Public API

`KnowledgeEngine`, `KnowledgeSystem`, `KnowledgeRegistry`, `KnowledgeCatalog`,
`KnowledgeRepository`, `KnowledgeResolver`, `KnowledgeFactory`, `KnowledgeValidator`,
`KnowledgeLifecycle`, `KnowledgePolicyEngine`, `KnowledgeRelationshipEngine`,
`KnowledgePermissionEngine`, `KnowledgeVersionEngine`, `KnowledgeTemplateEngine`,
`KnowledgeMetadataEngine`, `KnowledgeMetrics`, `KnowledgeHealth`, `KnowledgeEvents`,
`KnowledgeContext` — the 19 names required by the source prompt. As in
`@aos/workflow-integration`'s non-"Export ONLY" packages, `src/index.ts` also re-exports
the Domain/Contracts/Errors/Namespace/Factory-sub-classes/Validator-stages surface a
caller needs to actually construct valid input.

## Quick example

```ts
import { EventBroker } from "@aos/event-bus";
import {
  createKnowledgeContext,
  KnowledgeAssetType,
  KnowledgeClassification,
  KnowledgeEngine,
  KnowledgeEvents,
} from "@aos/knowledge-engine";

const bus = new EventBroker();
const engine = new KnowledgeEngine({ events: new KnowledgeEvents(bus) });

const context = createKnowledgeContext({ tenantId: "tenant-1", workspaceId: "ws-1" });

const document = engine.factory.document.create({
  assetType: KnowledgeAssetType.SUPPORT,
  scope: { tenantId: "tenant-1", workspaceId: "ws-1" },
  classification: KnowledgeClassification.INTERNAL,
  owner: { id: "u-1", name: "Jane Doe" },
});

const saved = await engine.createAsset(document, context);
// saved.id, saved.namespace ("knowledge://tenant-1/ws-1/.../doc-id")
```

## Architecture

```
KnowledgeEngine (engine/) — the public façade
        │
        ├── KnowledgeRepository / KnowledgeCatalog / KnowledgeResolver
        ├── KnowledgeFactory (7 sub-factories) / KnowledgeValidator (14 stages)
        ├── KnowledgeLifecycle (12 states) / KnowledgePolicyEngine (10 types)
        ├── KnowledgeRelationshipEngine (15 types + structural inverse)
        ├── KnowledgePermissionEngine / KnowledgeVersionEngine
        ├── KnowledgeTemplateEngine (19 categories) / KnowledgeMetadataEngine
        ├── KnowledgeRegistry (10 generic buckets)
        └── KnowledgeMonitor (Metrics + Health → Dashboard)
                │
                ▼
        contracts/ — 14 interface-only extension points
        (Indexer, Retriever, EmbeddingProvider, Chunker, VectorStore, Synchronizer,
         Generator, Translator, Reviewer, Approver, Recommendation, Graph, Analytics,
         QualityEngine) — zero implementations in this package
```

## Knowledge Namespace

Hierarchical `knowledge://tenant/workspace/library/document` URIs
(`namespace/knowledge-namespace.ts`): `buildKnowledgeNamespaceUri()` composes one,
`parseKnowledgeNamespace()` parses it back (throws `InvalidNamespaceException` on the
wrong scheme or segment count), `isValidKnowledgeNamespace()` is a boolean check.
`KnowledgeRepository` indexes every saved Asset by both `id` and its parsed namespace.

## Lifecycle

12 states (Draft → Imported → Pending Review → Approved → Published → Indexed →
Deprecated → Archived → Disabled → Deleted → Expired → Versioned). Only `DELETED` is
terminal. `KnowledgeLifecycle.transition()` enforces the legal edge table, throwing
`IllegalLifecycleTransitionException` otherwise.

## Relationship Engine

15 relationship types (Parent/Child/Reference/Duplicate/Related/Depends On/Uses/
Implements/Generated From/Version Of/Derived From/Required By/Consumed By/Belongs To/
Linked To). `KnowledgeRelationshipEngine.add()` registers the given edge **and** its
structural inverse (e.g. `PARENT` ↔ `CHILD`) in one call.

## Policy Engine

10 policy types (Retention/Publishing/Classification/Access/Sharing/Compliance/
Validation/Review/Approval/Synchronization). `evaluate()` implements real rule logic for
Retention, Classification, Compliance, and Review; the remaining 6 are recognized and
scope-matched but yield no violations — enforcement for those is delegated to
`KnowledgePermissionEngine` (Access/Sharing), `KnowledgeValidator` (Validation), and
future `IKnowledgeApprover`/`IKnowledgeSynchronizer` contracts (Approval/Synchronization).

## Permission Engine

Scope- and environment-aware allow/deny checks (Role/Policy/Department/Workspace/
Solution Pack/Tenant/Organization/Environment). `check()` is **permissive by default**
when nothing governs an action/scope at all; when something does govern it, a held
`deny` always wins over a held `allow`, and holding neither denies the action.

## Versioning

Semantic Version bump/compare/diff/history/rollback, implemented with real in-memory
logic (no durable backend, matching this package's "Persistence: None" convention).
`branch()`/`merge()` from the source prompt's vocabulary are **not implemented** — see
Known Limitations.

## Registry

`KnowledgeRegistry` is one generic class covering all 10 buckets the source prompt
requires (Schema/Template/Category/Policy/Provider/Namespace/Relationship/Library/
Collection/Version) via a single `Map<KnowledgeRegistryBucket, Map<string, Identified>>`.

## Validation

`KnowledgeValidator` runs 14 stages in fixed order, aggregating every issue without
short-circuiting: Schema, Metadata, Version, Relationship, Namespace, Policy, Permission,
Classification, Language, Ownership, Tenant, Workspace, Collection, Template. Accepts an
optional `extraStages` array for caller-supplied additions.

## Metrics

```
KnowledgeMetrics
├── knowledgeCount / documentCount / workspaceCount / libraryCount
├── templateCount / policyCount / relationshipCount / versionCount
├── validationErrors
├── tenantUsage / departmentUsage
└── storageBytes
```

## Health

5 statuses (Healthy/Warning/Degraded/Unavailable/Unknown). `KnowledgeHealth.check()`
derives Repository/Registry health from whether anything is stored, and Validation
health from the live `validationErrors / knowledgeCount` ratio; overall `status` is the
worst of all three.

## Monitoring

`KnowledgeMonitor.sample()` combines a Metrics snapshot and a Health report into one
`KnowledgeDashboard` with 7 named sections: Knowledge, Workspace, Policy, Relationship,
Version, Tenant, Validation Dashboard.

## Folder Structure

| Folder          | Contents                                                         |
| --------------- | ---------------------------------------------------------------- |
| `domain/`       | 30+ named aggregates as Zod schema + type pairs                  |
| `contracts/`    | 14 interface-only extension points                               |
| `errors/`       | `KnowledgeException` + 10 concrete subclasses                    |
| `context/`      | `KnowledgeContext`, `createKnowledgeContext()`                   |
| `namespace/`    | `knowledge://` URI build/parse/validate                          |
| `registry/`     | `KnowledgeRegistry` (10 generic buckets)                         |
| `repository/`   | `KnowledgeRepository` — in-memory Asset store                    |
| `catalog/`      | `KnowledgeCatalog` — read-only filtered search                   |
| `resolver/`     | `KnowledgeResolver` — resolution only                            |
| `factory/`      | `KnowledgeFactory` + 7 sub-factories                             |
| `validator/`    | 14 validator stages + `KnowledgeValidator` aggregator            |
| `lifecycle/`    | `KnowledgeLifecycle` — 12-state transition table                 |
| `policy/`       | `KnowledgePolicyEngine`                                          |
| `permission/`   | `KnowledgePermissionEngine`                                      |
| `relationship/` | `KnowledgeRelationshipEngine`                                    |
| `version/`      | `KnowledgeVersionEngine`                                         |
| `template/`     | `KnowledgeTemplateEngine` — 19 categories                        |
| `metadata/`     | `KnowledgeMetadataEngine`                                        |
| `events/`       | `KnowledgeEvents`, `KnowledgeEventType` (11 values)              |
| `metrics/`      | `KnowledgeMetrics`                                               |
| `health/`       | `KnowledgeHealth`                                                |
| `monitoring/`   | `KnowledgeMonitor`                                               |
| `engine/`       | `KnowledgeEngine` — the public façade                            |
| `bootstrap/`    | `KnowledgeSystem` — implements `@aos/runtime-kernel`'s `IModule` |
| `config/`       | `KnowledgeEngineConfig`                                          |

## Event Bus namespace

`knowledge.created`, `.updated`, `.deleted`, `.archived`, `.version.created`,
`.review.completed`, `.policy.changed`, `.permission.changed`, `.relationship.created`,
`.validation.failed`, `.health.changed` — every one published via the real
`@aos/event-bus` `IPublisher`.

## Known Limitations

- **All 14 extension-point contracts have zero implementations** — by design.
- **`KnowledgeVersionEngine` has no `branch()`/`merge()`** — see the closing report.
- **`KnowledgePolicyEngine` evaluates only Retention/Classification/Compliance/Review
  rule fields** — the other 6 policy types are recognized but delegate enforcement
  elsewhere.
- **`knowledge.health.changed` is declared but never published** — no scheduled
  Health-diffing sampler exists in this package.

## Future Integration

`IKnowledgeIndexer`/`IKnowledgeRetriever`/`IKnowledgeEmbeddingProvider`/
`IKnowledgeChunker`/`IKnowledgeVectorStore`/`IKnowledgeSynchronizer`/
`IKnowledgeGenerator`/`IKnowledgeTranslator`/`IKnowledgeReviewer`/`IKnowledgeApprover`/
`IKnowledgeRecommendation`/`IKnowledgeGraph`/`IKnowledgeAnalytics`/
`IKnowledgeQualityEngine` are this package's fourteen extension points for later
Engineering Tasks. See `docs/005.7A-KNOWLEDGE-ENGINE-REPORT.md` for the full readiness
checklist handed to 005.7B.

## Persistence

None. `KnowledgeRepository`/`KnowledgeRegistry` are in-memory only.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.7A-KNOWLEDGE-ENGINE-REPORT.md` for coverage numbers, known limitations, and the
readiness checklist for 005.7B — **not implemented in this package**.
