# @aos/workflow-runtime

The AOS Workflow Runtime Core — loads Workflow Definitions (`@aos/workflow-definition`,
read-only), creates and lifecycle-manages Workflow Instances, maintains Execution
Context/State, and publishes `workflow.instance.*` events. **Not BPMN. Not Camunda. Not
Temporal. Not n8n.** This package never executes a Node — see
`docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md` for the explicit scope boundary and
`docs/005.6B-WORKFLOW-RUNTIME-CORE-REPORT.md` for the readiness checklist handed to
005.6C (Node Runtime).

## Quick example

```ts
import { EventBroker } from "@aos/event-bus";
import { WorkflowDefinitionRegistry, WorkflowBuilder, NodeType } from "@aos/workflow-definition";
import { WorkflowRuntime, WorkflowRuntimeEventPublisher } from "@aos/workflow-runtime";

const bus = new EventBroker();
const registry = new WorkflowDefinitionRegistry();
registry.register(
  WorkflowBuilder.create("order-fulfillment", "1.0.0")
    .addNode({ id: "start", name: "Start", type: NodeType.START })
    .addNode({ id: "end", name: "End", type: NodeType.END })
    .build(),
);

const runtime = new WorkflowRuntime({
  definitionRegistry: registry,
  eventPublisher: new WorkflowRuntimeEventPublisher(bus),
});

const execution = await runtime.createInstance({ workflowId: "order-fulfillment" });
await runtime.initialize(execution.instance.token);
await runtime.start(execution.instance.token);
await runtime.complete(execution.instance.token); // publishes workflow.instance.completed
```

## Architecture: Loader/Resolver/Validator → Middleware Pipeline → State Machine → Registry/Events

`WorkflowRuntime` (`runtime/workflow-runtime.ts`) is the composition root and this
package's entire public API — every internal module is a private implementation detail
behind it:

1. **`createInstance()`** loads a Workflow Definition (`loader/`, read-only against
   `@aos/workflow-definition`'s `IWorkflowDefinitionRegistry`), resolves its Start Node
   (`resolver/`), validates it (`validator/`, wrapping `@aos/workflow-definition`'s
   `ValidationPipeline` plus Tenant Isolation), and creates a `WorkflowInstance` in
   `InstanceState.CREATED` with a fresh `ExecutionToken`.
2. **`initialize()`/`start()`/`pause()`/`resume()`/`cancel()`/`expire()`/`complete()`/
   `fail()`** each dispatch through the **Runtime Middleware Pipeline**
   (`middleware/middleware-pipeline.ts`) — Validation → Permission → Tracing → Metrics →
   Lifecycle (terminal) — before the **State Machine** (`state-machine/`) applies the
   actual `InstanceState` transition, throwing `IllegalTransitionException` for anything
   `instance/instance-state.ts`'s `INSTANCE_STATE_TRANSITIONS` doesn't allow.
3. Every operation is addressed by **`ExecutionToken`** alone
   (`execution/workflow-execution-coordinator.ts`) — never by scanning for a matching
   state.
4. Every state-changing call ends by publishing the matching `workflow.instance.*` event
   via `WorkflowRuntimeEventPublisher` onto the real `@aos/event-bus`.

## 3 additions beyond the source prompt (user-requested)

- **Execution Token** (`instance/execution-token.ts`) — every Instance carries one;
  pause/resume/cancel/replay all resolve state through it, never through a state scan.
- **Execution Lease** (`execution/i-execution-lease.ts`) — `IExecutionLease`/
  `IExecutionLeaseProvider` interfaces only, unused today; the future multi-node
  concurrency-prevention extension point.
- **Runtime Middleware** (`middleware/`) — Validation → Permission → Tracing → Metrics →
  Lifecycle. Adding audit/billing/quota/observability later is `runtime.use(new
MyMiddleware())`, never a Workflow Runtime Core change.

## Instance State

Created → Ready → Running ⇄ (Waiting | Paused) → Completed | Cancelled | Failed → (Failed
→) Compensating → Compensated | Expired. See `instance/instance-state.ts`'s
`INSTANCE_STATE_TRANSITIONS` for the authoritative table.

## Folder Structure

| Folder                    | Contents                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `instance/`               | `WorkflowInstance`, `WorkflowExecution`, `ExecutionToken`, `ExecutionPointer`, `WorkflowHistory`, `WorkflowSnapshotReference`, `InstanceState` + transitions |
| `context/`                | `WorkflowContext`, `ExecutionMode`                                                                                                                           |
| `state-machine/`          | `WorkflowStateMachine` — the only code that changes `InstanceState`                                                                                          |
| `loader/`                 | `WorkflowLoader` — read-only against `IWorkflowDefinitionRegistry`, wraps `CompatibilityChecker`                                                             |
| `resolver/`               | `WorkflowResolver` — structural Node/Transition lookups, no expression evaluation                                                                            |
| `validator/`              | `WorkflowRuntimeValidator` — reuses `@aos/workflow-definition`'s `ValidationPipeline` + Tenant Isolation                                                     |
| `lifecycle/`              | `WorkflowLifecycleManager` — named ops wrapping the State Machine; `IRestartable` is interface-only                                                          |
| `execution/`              | `WorkflowExecutionCoordinator` (token → live Execution), `IExecutionLease` (interface only)                                                                  |
| `middleware/`             | `RuntimeMiddlewarePipeline` + Validation/Permission/Tracing/Metrics/Lifecycle stages                                                                         |
| `snapshot/`               | `SnapshotManager` — in-memory, no persistence                                                                                                                |
| `checkpoint/`             | `ICheckpoint`/`ICheckpointStore` — interfaces only                                                                                                           |
| `replay-interface/`       | `IWorkflowReplay` — interface only, wraps `@aos/event-bus`'s Replay concept                                                                                  |
| `compensation-interface/` | `ICompensationHandler`/`ICompensationCoordinator` — interfaces only                                                                                          |
| `events/`                 | `WorkflowRuntimeEventPublisher` — publishes onto `@aos/event-bus`                                                                                            |
| `metrics/`                | `WorkflowRuntimeMetricsCollector`                                                                                                                            |
| `health/`                 | `WorkflowRuntimeHealth` — Runtime/Loader/Validator/State Machine/Context Health                                                                              |
| `monitoring/`             | `WorkflowRuntimeMonitor` (Metrics + Health) — re-exports `@aos/event-bus`'s Tracing port                                                                     |
| `config/`                 | `WorkflowRuntimeConfig`                                                                                                                                      |
| `runtime/`                | `WorkflowRuntime` — the public façade                                                                                                                        |
| `bootstrap/`              | `WorkflowRuntimeSystem` — implements `@aos/runtime-kernel`'s `IModule`                                                                                       |
| `errors/`                 | `WorkflowRuntimeException` + 9 concrete subclasses                                                                                                           |

## Event Bus namespace

`workflow.instance.created`, `.initialized`, `.started`, `.paused`, `.resumed`,
`.completed`, `.failed`, `.cancelled`, `.expired`, `.snapshot.created`, `.state.changed` —
every one published via the real `@aos/event-bus` `IPublisher`.

## Persistence

None. `WorkflowExecutionCoordinator` and `SnapshotManager` are in-memory only — a durable
store is future work.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.6B-WORKFLOW-RUNTIME-CORE-REPORT.md` for coverage numbers, known limitations, and
the readiness checklist for Engineering Task 005.6C (Node Runtime) — **not implemented in
this package**.
