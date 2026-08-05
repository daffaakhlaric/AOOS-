# @aos/workflow-integration

The AOS Enterprise Workflow Integration Layer — the integration bridge between
`@aos/workflow-execution` and every future runtime (Capability, Tool, Connector,
Knowledge, Memory, AI Gateway, Model Router, Agent, Prompt, Experience). **This package
implements no Capability Runtime, Tool Runtime, Connector Runtime, Knowledge Runtime,
Memory Runtime, AI Gateway, or Agent Runtime.** It only defines contracts, adapters, and
orchestration — it never executes a Capability, Tool, Connector, Knowledge query, Memory
read/write, Model call, Agent run, or Prompt render itself. See
`docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md` for the explicit scope boundary and
`docs/005.6E-WORKFLOW-INTEGRATION-REPORT.md` for the readiness checklist handed to
005.7A.

## Public API

`WorkflowIntegration`, `WorkflowIntegrationSystem`, `WorkflowIntegrationRegistry`,
`WorkflowIntegrationContext`, `WorkflowIntegrationPipeline`, `WorkflowIntegrationMiddleware`,
`WorkflowIntegrationResolver`, `WorkflowIntegrationValidator`, `WorkflowIntegrationMetrics`,
`WorkflowIntegrationHealth` — the 10 names required by the source prompt. Unlike
`@aos/workflow-execution`'s "Export ONLY" restriction, this package's `src/index.ts` also
re-exports the Contracts/Adapter/Future/Events/Errors surface a caller needs to actually
configure and use them.

## Quick example

```ts
import { EventBroker } from "@aos/event-bus";
import { createExecutionToken } from "@aos/workflow-execution";
import {
  CapabilityAdapter,
  createWorkflowIntegrationContext,
  IntegrationNamespace,
  WorkflowIntegration,
  WorkflowIntegrationEventPublisher,
} from "@aos/workflow-integration";

const bus = new EventBroker();
const integration = new WorkflowIntegration({
  eventPublisher: new WorkflowIntegrationEventPublisher(bus),
});

// A future Capability Runtime Engineering Task supplies a real ICapabilityRuntime;
// until then, an Adapter with no runtime configured is a normal "unavailable" outcome.
integration.registerAdapter(new CapabilityAdapter("crm", myCapabilityRuntime));

const token = createExecutionToken({ workflowInstanceId: "wf-instance-1" });
const context = createWorkflowIntegrationContext({ token, workflowId: "onboard-lead" });

const outcome = await integration.integrate(
  IntegrationNamespace.CAPABILITY,
  { operation: "create", input: { name: "Acme" } },
  context,
);
// outcome.result.success, outcome.context.capabilityResult
```

## Architecture

```
Workflow Execution Engine (@aos/workflow-execution)
        │
        ▼
WorkflowIntegration (integration/) — the public façade
        │
        ▼
WorkflowIntegrationPipeline (pipeline/)
  Validation → Permission → Tracing → Metrics → Tenant → Environment →
  Retry → Timeout → Logging → Audit → AdapterExecutionMiddleware (terminal)
        │
        ▼
WorkflowIntegrationResolver (resolver/) ── "Only resolution. Never execution."
        │
        ▼
WorkflowIntegrationRegistry (registry/) — Adapters keyed by IntegrationNamespace
        │
 ┌──────┼────────┬───────────┬───────────┬─────────┬─────────┬────────┬─────────┬────────────┐
 ▼      ▼        ▼           ▼           ▼         ▼         ▼        ▼         ▼
Capability Tool Connector  Knowledge   Memory    Prompt    Model    Agent   Experience
Adapter  Adapter Adapter    Adapter    Adapter   Adapter  Adapter  Adapter   Adapter
 │        │        │          │          │         │         │        │         │
 ▼        ▼        ▼          ▼          ▼         ▼         ▼        ▼         ▼
ICapabilityRuntime IToolRuntime IConnectorRuntime IKnowledgeRuntime IMemoryRuntime
IPromptRuntime  IModelRouter/IAIGateway  IAgentRuntime  IExperienceRuntime
   (all 10 contracts — interface only, zero implementations in this package)
```

`WorkflowIntegration` (`integration/workflow-integration.ts`) is the composition root and
this package's entire public façade — it owns a `WorkflowIntegrationRegistry`, wraps a
`WorkflowIntegrationResolver` and `WorkflowIntegrationPipeline`, and never itself calls
into a Capability/Tool/Connector/etc. — every actual delegation happens inside the
resolved `IIntegrationAdapter`'s own `execute()`, which in turn only forwards to whatever
future-runtime contract instance the caller injected (or reports a normal "unavailable"
business failure if none was).

## Integration Flow

`WorkflowIntegration.integrate(namespace, request, context)` → records
`recordIntegrationStarted()` → publishes `workflow.integration.started` → runs the
10-stage `WorkflowIntegrationMiddleware` chain via `WorkflowIntegrationPipeline` →
`AdapterExecutionMiddleware` resolves the target `IIntegrationAdapter`
(`WorkflowIntegrationResolver#resolve()`) and calls `adapter.execute(request)` exactly
once → the outcome is written onto the matching `*Result` slot of
`WorkflowIntegrationContext` (`withIntegrationResult()`) → publishes
`workflow.integration.completed`/`.failed` → returns `{ context, result }`.

A namespace with no registered Adapter, or an Adapter with no injected runtime, is a
normal **business failure** (`IntegrationResult{success:false}`), never a thrown
exception — mirroring `@aos/workflow-execution`'s `ICapabilityExecutor` absence handling.
Genuine setup problems (a Registry that fails `WorkflowIntegrationValidator`, a denied
Permission check, an exceeded Timeout, an exhausted Retry Policy) still throw.

## Adapter Design

9 concrete Adapters (`CapabilityAdapter`, `ToolAdapter`, `ConnectorAdapter`,
`KnowledgeAdapter`, `MemoryAdapter`, `PromptAdapter`, `ModelAdapter`, `AgentAdapter`,
`ExperienceAdapter`) all extend `BaseIntegrationAdapter<TRuntime>` — a thin,
no-business-logic wrapper: `execute()` either forwards to the injected runtime contract
unchanged, or returns `{success:false, error}` when none was configured. `ModelAdapter` is
the one exception, wrapping **two** optional contracts (`IModelRouter` and `IAIGateway`,
preferring the former) since the source prompt's Adapter Layer lists 9 Adapters but 10
Contracts — `IAIGateway` has no dedicated Adapter of its own.

## Resolver Design

`WorkflowIntegrationResolver` never executes anything — `resolve(namespace)` and the 9
namespace-specific `resolveCapability()`/`resolveTool()`/... helpers are thin lookups over
`WorkflowIntegrationRegistry#resolve()` (highest-`priority`, optionally
name/version/availability-filtered). `resolveChain()` walks the canonical
`INTEGRATION_RESOLUTION_ORDER` (Capability → Tool → Connector → Knowledge → Memory →
Prompt → Model → Agent → Experience), silently skipping any namespace with nothing
registered — useful as a pre-flight readiness check before a real `integrate()` call.

## Validation Pipeline

`WorkflowIntegrationValidator` runs 8 stages in order, aggregating every issue (never
short-circuits): Duplicate Adapter (same name reused across namespaces), Namespace
(unknown `IntegrationNamespace` value), Version (invalid `MAJOR.MINOR.PATCH`), Circular
Integration (DFS cycle detection over caller-declared Adapter dependencies), Missing
Runtime (an Adapter with no injected contract), Tenant (Context `tenantId` not in an
allow-list), Environment (Context `environment` not in an allow-list), Dependency (a
declared dependency name that resolves to no registered Adapter). `ValidationMiddleware`
(the Pipeline's first stage) runs this before every `integrate()` call.

## Middleware Pipeline

`WorkflowIntegrationMiddleware` is a Koa-style chain that — unlike
`@aos/workflow-execution`'s equivalent — deliberately allows a stage to call `next()` more
than once, since `RetryMiddleware` needs to re-run the remainder of the chain (Timeout →
Logging → Audit → the terminal Adapter call) on every retry attempt. 10 built-in stages:
Validation, Permission, Tracing, Metrics, Tenant, Environment, Retry (4 `RetryStrategy`
values: Immediate/Linear/Exponential/Custom), Timeout (a real `Promise.race()` against
`setTimeout`), Logging, Audit (via an optional `IAuditSink`). `use()` registers additional
Middleware ahead of the terminal `AdapterExecutionMiddleware`.

## Metrics

```
WorkflowIntegrationMetrics
├── integrations / completed / failures / retries / timeouts
├── averageResolutionTimeMs   (Resolver lookup latency)
├── averageDurationMs         (mean of completed Integration durations)
├── adapterUsage              (per-Adapter-name call count)
└── tenantUsage                (per-tenantId call count)
```

## Health

4 statuses (`Healthy`/`Degraded`/`Unavailable`/`Unknown`, per the source prompt — not the
3-value set used in `@aos/workflow-execution`). `WorkflowIntegrationHealth.check()`
derives per-Adapter health from `isAvailable()`, Registry health from whether anything is
registered at all (`Unknown` if empty), and Resolver health from the live failure ratio;
overall `status` is the worst of all three.

## Monitoring

`WorkflowIntegrationMonitor.sample()` combines a Metrics snapshot and a Health report into
one `IntegrationDashboard`, adding computed `errorRate`, `retryRate`, and
`averageLatencyMs`.

## Folder Structure

| Folder         | Contents                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `contracts/`   | 10 interface-only future-runtime contracts + `IntegrationNamespace`/`IntegrationRequest`/`IntegrationResult`                   |
| `context/`     | `WorkflowIntegrationContext`, `createWorkflowIntegrationContext()`, `withIntegrationResult()`                                  |
| `adapter/`     | `BaseIntegrationAdapter` + 9 concrete Adapters                                                                                 |
| `registry/`    | `WorkflowIntegrationRegistry`                                                                                                  |
| `resolver/`    | `WorkflowIntegrationResolver`                                                                                                  |
| `validator/`   | 8 validators + `WorkflowIntegrationValidator`                                                                                  |
| `middleware/`  | `WorkflowIntegrationMiddleware` + 10 stages                                                                                    |
| `retry/`       | `RetryPolicy`/`RetryStrategy`, `RetryCoordinator`                                                                              |
| `events/`      | `WorkflowIntegrationEventPublisher`, 8 named event types                                                                       |
| `metrics/`     | `WorkflowIntegrationMetrics`                                                                                                   |
| `health/`      | `WorkflowIntegrationHealth`                                                                                                    |
| `monitoring/`  | `WorkflowIntegrationMonitor`                                                                                                   |
| `pipeline/`    | `WorkflowIntegrationPipeline`, `AdapterExecutionMiddleware` (terminal stage)                                                   |
| `integration/` | `WorkflowIntegration` — the public façade                                                                                      |
| `bootstrap/`   | `WorkflowIntegrationSystem` — implements `@aos/runtime-kernel`'s `IModule`                                                     |
| `future/`      | 6 interface-only extension points (Checkpoint/Compensation/Saga/Distributed Transaction/Circuit Breaker/Rate Limiter Provider) |
| `errors/`      | `WorkflowIntegrationException` + 8 concrete subclasses                                                                         |

## Event Bus namespace

`workflow.integration.started`, `.completed`, `.failed`, `.adapter.resolved`,
`.validation.failed`, `.timeout`, `.retry`, `.health.changed` — every one published via
the real `@aos/event-bus` `IPublisher`. No runtime-specific events (no `capability.*`,
`tool.*`, etc.) are ever published by this package.

## Known Limitations

- **`ICapabilityRuntime`/`IToolRuntime`/`IConnectorRuntime`/`IKnowledgeRuntime`/
  `IMemoryRuntime`/`IAIGateway`/`IModelRouter`/`IAgentRuntime`/`IPromptRuntime`/
  `IExperienceRuntime` have zero implementations** — by design, "The package MUST know
  every contract. The package MUST execute nothing."
- **`workflow.integration.health.changed` is declared but never published** — no code
  path in this package currently diffs two Health snapshots and fires it; a future
  Monitoring integration (e.g. a scheduled `@aos/scheduler` job sampling
  `WorkflowIntegrationMonitor`) would need to add that.
- **`Checkpoint`/`Compensation`/`Saga`/`Distributed Transaction`/`Circuit Breaker`/`Rate
Limiter` Providers are interface-only** — no implementation, no wiring into the
  Middleware pipeline.
- **`TimeoutMiddleware` cannot cancel an in-flight downstream Adapter call** — it only
  stops _waiting_ for it, matching the same documented limitation in
  `@aos/workflow-execution`'s own Node Timeout handling.

## Future Integration

`ICapabilityRuntime`/`IToolRuntime`/`IConnectorRuntime`/`IKnowledgeRuntime`/
`IMemoryRuntime`/`IAIGateway`/`IModelRouter`/`IAgentRuntime`/`IPromptRuntime`/
`IExperienceRuntime` are this package's ten extension points for later Engineering Tasks.
See `docs/005.6E-WORKFLOW-INTEGRATION-REPORT.md` for the full readiness checklist handed
to 005.7A.

## Persistence

None. `WorkflowIntegrationRegistry` is in-memory only.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.6E-WORKFLOW-INTEGRATION-REPORT.md` for coverage numbers, known limitations, and
the readiness checklist for 005.7A — **not implemented in this package**.
