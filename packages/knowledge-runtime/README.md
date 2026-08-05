# @aos/knowledge-runtime

The AOS Enterprise Knowledge Runtime — the runtime lifecycle layer bridging
`@aos/knowledge-engine` to Workflow Runtime, Memory, Prompt Intelligence, Capability
Runtime, and Agent Runtime. **This package implements no embedding, vector search, RAG,
retrieval, chunking, synchronization, AI, LLM, search engine, prompting, memory, or agent
logic.** It only manages runtime state: Instances, Sessions, a strict finite-state
machine, a read-only Loader/Resolver over the Knowledge Engine, Middleware, Validation,
Metrics, Health. See `docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md` for the explicit scope
boundary and `docs/005.7B-KNOWLEDGE-RUNTIME-REPORT.md` for the readiness checklist handed
to 005.7C (Knowledge Indexing).

## Public API

`KnowledgeRuntime`, `KnowledgeRuntimeSystem`, `KnowledgeRuntimeContext`,
`KnowledgeRuntimeInstance`, `KnowledgeRuntimeSession`, `KnowledgeRuntimeManager`,
`KnowledgeRuntimeRegistry`, `KnowledgeRuntimeResolver`, `KnowledgeRuntimeLoader`,
`KnowledgeRuntimeValidator`, `KnowledgeRuntimeStateMachine`, `KnowledgeRuntimeLifecycle`,
`KnowledgeRuntimeMiddleware`, `KnowledgeRuntimeEvents`, `KnowledgeRuntimeMetrics`,
`KnowledgeRuntimeHealth`, `KnowledgeRuntimeMonitor`, `KnowledgeRuntimeFactory` — the 18
names required by the source prompt. `src/index.ts` also re-exports the
Domain/Contracts/Errors/Validator-stage/Middleware-stage/Factory-sub-class surface a
caller needs to actually build and use them.

## Quick example

```ts
import { EventBroker } from "@aos/event-bus";
import { KnowledgeEngine, KnowledgeEvents } from "@aos/knowledge-engine";
import { KnowledgeRuntime, KnowledgeRuntimeEvents } from "@aos/knowledge-runtime";

const bus = new EventBroker();
const knowledgeEngine = new KnowledgeEngine({ events: new KnowledgeEvents(bus) });
// ... engine.createAsset(...) elsewhere, in @aos/knowledge-engine's own write path ...

const runtime = new KnowledgeRuntime({
  knowledgeEngine,
  events: new KnowledgeRuntimeEvents(bus),
});

const execution = await runtime.createInstance({ knowledgeId: "asset-1", tenantId: "tenant-1" });
await runtime.load(execution.instance.token);
await runtime.validate(execution.instance.token);
await runtime.start(execution.instance.token);
await runtime.complete(execution.instance.token);
```

## Architecture

```
@aos/knowledge-engine (read-only)
        │
        ▼
KnowledgeRuntimeLoader / KnowledgeRuntimeResolver
        │
        ▼
KnowledgeRuntime (runtime/) — the public façade
        │
        ▼
KnowledgeRuntimeMiddleware
  Validation → Context → Permission → Policy → Tracing → Metrics →
  Lifecycle → Logging → Custom Middleware (runtime.use())
        │
        ▼
KnowledgeRuntimeLifecycle → KnowledgeRuntimeStateMachine (strict FSM)
        │
        ▼
KnowledgeRuntimeManager
  ├── KnowledgeRuntimeRegistry (token-keyed, never scanned)
  ├── KnowledgeRuntimeSession  (Open/Close/Suspend/Resume/Renew/Expire/Destroy)
  └── SnapshotManager          (point-in-time capture, no persistence)
        │
        ▼
KnowledgeRuntimeFactory
        │
        ▼
contracts/ — 10 interface-only extension points, zero implementations
```

## Runtime Lifecycle

13 states: Created → Loading → Loaded → Validating → Ready → Running → Suspended →
Resuming → Completed | Failed | Cancelled | Expired → Destroyed. `DESTROYED` is the only
true terminal state. `KnowledgeRuntimeStateMachine` is a strict FSM — every transition is
checked against `KNOWLEDGE_RUNTIME_STATE_TRANSITIONS`, throwing
`IllegalRuntimeTransitionException` for anything not listed.

## Middleware

8 named stages (Validation → Context → Permission → Policy → Tracing → Metrics →
Lifecycle → Logging), matching the source prompt's architecture diagram, with custom
Middleware appended via `runtime.use()` after Logging. Permission/Policy are permissive
by default when no checker is configured.

## Session

Open/Close/Suspend/Resume/Renew/Expire/Destroy over an in-memory
`Map<instanceToken, SessionRecord>` — no persistence. Each open Session carries a
time-bound Lease; `renew()` throws once the Lease has already expired.

## Registry

One `Map<KnowledgeRuntimeToken, KnowledgeRuntimeExecution>` — "Never search runtime
instances by scanning collections. Use token lookup."

## Loader / Resolver

Read-only. `KnowledgeRuntimeLoader` reads Knowledge Assets from the injected
`KnowledgeEngine`'s Repository/Catalog/Registry. `KnowledgeRuntimeResolver` resolves
Asset/Namespace/Relationships/Dependencies/References/Policies/Permission/Version
History/Templates — "No retrieval. No indexing."

## Validation

11 stages run in fixed order, aggregating every issue: Runtime State, Context,
Permission, Policy, Lifecycle, Relationships, Namespace, Metadata, Tenant, Workspace,
Execution Token.

## Metrics

```
KnowledgeRuntimeMetrics
├── runtimeCount / activeRuntimeCount / failedRuntimeCount / suspendedRuntimeCount
├── averageExecutionTimeMs / averageLoadTimeMs
├── validationFailures
├── tenantUsage / workspaceUsage
└── lifecycleStatistics
```

## Health

5 statuses (Healthy/Warning/Degraded/Unavailable/Unknown). `KnowledgeRuntimeHealth.check()`
derives Registry health from whether anything is registered, Validation health from the
live `validationFailures/runtimeCount` ratio, and Failure Rate health from
`failedRuntimeCount/runtimeCount`; overall `status` is the worst of all three.

## Monitoring

`KnowledgeRuntimeMonitor.sample()` combines a Metrics snapshot and a Health report into
one `KnowledgeRuntimeDashboard` with 7 named sections: Runtime, Execution, Lifecycle,
Validation, Tenant, Workspace, Performance Dashboard.

## Folder Structure

| Folder           | Contents                                                                   |
| ---------------- | -------------------------------------------------------------------------- |
| `domain/`        | 13 named runtime aggregates as Zod schema + type pairs                     |
| `contracts/`     | 10 interface-only extension points                                         |
| `errors/`        | `KnowledgeRuntimeException` + 11 concrete subclasses                       |
| `token/`         | `KnowledgeRuntimeToken` generate/validate                                  |
| `context/`       | `KnowledgeRuntimeContext`, `createKnowledgeRuntimeContext()`               |
| `session/`       | `KnowledgeRuntimeSession` — Open/Close/Suspend/Resume/Renew/Expire/Destroy |
| `state-machine/` | `KnowledgeRuntimeStateMachine` — strict 13-state FSM                       |
| `lifecycle/`     | `KnowledgeRuntimeLifecycle` — 13 named operations                          |
| `loader/`        | `KnowledgeRuntimeLoader` — read-only over `@aos/knowledge-engine`          |
| `resolver/`      | `KnowledgeRuntimeResolver` — read-only pass-through                        |
| `registry/`      | `KnowledgeRuntimeRegistry` — token-keyed Instance store                    |
| `snapshot/`      | `SnapshotManager` — point-in-time capture, no persistence                  |
| `manager/`       | `KnowledgeRuntimeManager` — Registry + Session + Snapshot orchestrator     |
| `validator/`     | 11 validator stages + `KnowledgeRuntimeValidator` aggregator               |
| `middleware/`    | `KnowledgeRuntimeMiddleware` pipeline + 8 stages                           |
| `factory/`       | `KnowledgeRuntimeFactory` + 5 sub-factories                                |
| `events/`        | `KnowledgeRuntimeEvents`, `KnowledgeRuntimeEventType` (12 values)          |
| `metrics/`       | `KnowledgeRuntimeMetrics`                                                  |
| `health/`        | `KnowledgeRuntimeHealth`                                                   |
| `monitoring/`    | `KnowledgeRuntimeMonitor`                                                  |
| `runtime/`       | `KnowledgeRuntime` — the public façade                                     |
| `bootstrap/`     | `KnowledgeRuntimeSystem` — implements `@aos/runtime-kernel`'s `IModule`    |
| `config/`        | `KnowledgeRuntimeConfig`                                                   |

## Event Bus namespace

`knowledge.runtime.created`, `.loaded`, `.ready`, `.started`, `.suspended`, `.resumed`,
`.completed`, `.failed`, `.cancelled`, `.destroyed`, `.validation.failed`,
`.health.changed` — every one published via the real `@aos/event-bus` `IPublisher`.

## Known Limitations

- **All 10 extension-point contracts have zero implementations** — by design.
- **Permission/Policy Middleware are permissive by default** — real enforcement needs a
  caller-supplied `IKnowledgeRuntimePermissionChecker`/`IKnowledgeRuntimePolicyChecker`.
- **`knowledge.runtime.health.changed` is declared but never published** — no scheduled
  Health-diffing sampler exists in this package.
- **`IKnowledgeRuntimeObserver`/`IKnowledgeRuntimeHook` are not wired into the Middleware
  pipeline** — declared but unused by any built-in stage.

## Future Integration

`IKnowledgeRuntimeCache`/`IKnowledgeRuntimeStorage`/`IKnowledgeRuntimeCheckpoint`/
`IKnowledgeRuntimeReplay`/`IKnowledgeRuntimeCompensation`/`IKnowledgeRuntimeObserver`/
`IKnowledgeRuntimeHook`/`IKnowledgeRuntimeTracer`/`IKnowledgeRuntimeScheduler`/
`IKnowledgeRuntimeLeaseProvider` are this package's ten extension points for later
Engineering Tasks. See `docs/005.7B-KNOWLEDGE-RUNTIME-REPORT.md` for the full readiness
checklist handed to 005.7C.

## Persistence

None. `KnowledgeRuntimeRegistry`/`KnowledgeRuntimeSession`/`SnapshotManager` are
in-memory only.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.7B-KNOWLEDGE-RUNTIME-REPORT.md` for coverage numbers, known limitations, and
the readiness checklist for 005.7C — **not implemented in this package**.
