# @aos/workflow-execution

The AOS Enterprise Workflow Execution Engine — orchestrates one Workflow Execution
end-to-end by driving `@aos/workflow-runtime` (Workflow Instance lifecycle) and
`@aos/node-runtime` (Node Instance lifecycle) together, walking a Workflow Definition's
graph Node-by-Node. **This is not an Agent Runtime, Planner, Reasoner, Reflection Engine,
Simulation Runtime, AI Gateway, or Model Router.** This package never executes Node logic
itself and never calls an AI/OpenAI/Tool API directly — Capability execution is defined as
an interface only. See `docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md` for the explicit
scope boundary and `docs/005.6D-WORKFLOW-EXECUTION-ENGINE-REPORT.md` for the readiness
checklist handed to 005.6E (Workflow Integration).

## Public API

**Expose ONLY `WorkflowExecutionEngine`, `ExecutionToken`, `ExecutionContext`,
`ExecutionResult`, `ExecutionState`, and the Interfaces.** Everything else in this package
is an internal implementation detail. `src/index.ts` also carries the minimal
data-contract surface (types/enums/errors/factory functions) required to actually call
`WorkflowExecutionEngine`'s methods and interpret their results — see that file's own doc
comment for the exact boundary.

## Quick example

```ts
import { EventBroker } from "@aos/event-bus";
import { NodeRuntime, NodeRuntimeEventPublisher } from "@aos/node-runtime";
import { WorkflowDefinitionRegistry, WorkflowDefinitionStatus } from "@aos/workflow-definition";
import { WorkflowRuntime, WorkflowRuntimeEventPublisher } from "@aos/workflow-runtime";
import { ExecutionEventPublisher, WorkflowExecutionEngine } from "@aos/workflow-execution";

const bus = new EventBroker();

const registry = new WorkflowDefinitionRegistry();
registry.register(myDefinition, WorkflowDefinitionStatus.PUBLISHED);

const workflowRuntime = new WorkflowRuntime({
  definitionRegistry: registry,
  eventPublisher: new WorkflowRuntimeEventPublisher(bus),
});
const nodeRuntime = new NodeRuntime({ eventPublisher: new NodeRuntimeEventPublisher(bus) });

const engine = new WorkflowExecutionEngine({
  workflowRuntime,
  nodeRuntime,
  eventPublisher: new ExecutionEventPublisher(bus),
  config: { capabilityExecutor: myCapabilityExecutor }, // optional — see "Capability Execution" below
});

const result = await engine.executeWorkflow({ workflowId: myDefinition.id });
// result.success, result.nodesVisited, result.error?
```

## Architecture

```
executeWorkflow(input)
        │
        ▼
workflowRuntime.createInstance() ──▶ WorkflowDefinition + WorkflowInstance (from @aos/workflow-runtime)
        │
        ▼
createExecutionToken() + createExecutionContext() + buildExecutionGraph() + createExecutionCursor()
        │
        ▼
runOperation("initialize") → runOperation("start")   (this package's OWN ExecutionState machine)
workflowRuntime.initialize() → workflowRuntime.start() (the underlying WorkflowInstance's OWN state machine)
        │
        ▼
        runGraph()  ── frontier-based Node-by-Node walk ──┐
        │                                                  │
        │  for each Node in the current frontier:          │
        │    executeNodeWithRetry(nodeId)                  │
        │      └─▶ executeNodeOnce(nodeId)                 │
        │            nodeRuntime.createFromDefinition()    │
        │            nodeRuntime.initialize()/.start()     │
        │            (CAPABILITY Node → executeCapabilityNode() → ICapabilityExecutor, if configured)
        │            nodeRuntime.complete()/.fail()         │
        │    transitionEngine.resolve(outcome) ──▶ next Node id(s)
        │                                                  │
        └──────────────────────────────────────────────────┘
        │
        ▼
runOperation("complete" | "fail") → workflowRuntime.complete()/.fail()
        │
        ▼
ExecutionResult { success, nodesVisited, error? }
```

`WorkflowExecutionEngine` (`engine/workflow-execution-engine.ts`) is the composition root.
It tracks **three intentionally-parallel state-tracking layers** for one Workflow
Execution — this package's own `ExecutionSession`/`ExecutionState` machine, the underlying
`@aos/workflow-runtime` `WorkflowInstance`'s own state machine, and each
`@aos/node-runtime` `NodeInstance`'s own state machine — never duplicating any of their
internal logic, only orchestrating calls into their public APIs.

## Execution Flow

Workflow Start → Load Definition (`workflowRuntime.createInstance()`) → Create Token
(`createExecutionToken()`) → Create Context (`createExecutionContext()`) → Resolve Graph
(`buildExecutionGraph()`) → Resolve First Node (`graph.startNodeId`) → Validate Node
(`ValidationMiddleware`/`ExecutionValidationPipeline`) → Execute Node
(`nodeRuntime.start()`/`.complete()`/`.fail()`, or `ICapabilityExecutor` for a Capability
Node) → Wait Result → Resolve Transition (`TransitionEngine.resolve()`) → Next Node →
Workflow Complete (`workflowRuntime.complete()`/`.fail()`).

## State Machine

11 states: `Created → Ready → Running ⇄ (Waiting | Paused | Retrying) → Completed | Failed
| Cancelled | Timeout`; `Failed → Compensating`. See
`state-machine/execution-state.ts`'s `EXECUTION_STATE_TRANSITIONS` for the authoritative
table — `ExecutionStateMachine.transition()` is the only code allowed to change
`ExecutionContext.currentState`, and every legal transition appends one
`ExecutionHistoryEntry`.

```
CREATED ──▶ READY ──▶ RUNNING ──▶ COMPLETED
  │           │          │  │
  │           │          │  └──▶ WAITING ──▶ RUNNING
  │           │          ├──▶ PAUSED ──▶ RUNNING
  │           │          ├──▶ RETRYING ──▶ RUNNING
  │           │          ├──▶ FAILED ──▶ COMPENSATING
  │           │          ├──▶ CANCELLED
  │           │          └──▶ TIMEOUT
  └──▶ CANCELLED
```

## Checkpoint Flow (interface only)

`ExecutionCheckpoint` (`checkpoint/execution-checkpoint.ts`) is a point-in-time capture of
an `ExecutionCursor` + `ExecutionContext`. `ICheckpointStore` (`checkpoint/i-checkpoint-store.ts`)
declares `save()`/`get()`/`list()`/`delete()` — **no class in this package implements it**;
no checkpoint is ever created, persisted, or restored today.

## Retry Flow

```
executeNodeOnce(nodeId) → outcome "failure"
        │ (only if config.retryPolicy is set)
        ▼
retryCoordinator.recordAttempt(nodeId, policy) → RetryMetadata { attempt, delayMs }
        │ (throws RetryExhaustedException once attempt > maxAttempts)
        ▼
publish NODE_RETRY → executeNodeOnce(nodeId) again
```

4 strategies (`retry/retry-policy.ts`): `Immediate` (0ms), `Linear`
(`baseDelayMs * attempt`), `Exponential` (`baseDelayMs * 2^(attempt-1)`, capped by
`maxDelayMs`), `Custom` (`customDelayFn`). No `setTimeout`/sleep is actually inserted
between attempts — see Known Limitations.

## Cancellation Flow

`engine.cancel(workflowExecutionId, reason?)` transitions this package's own
`ExecutionSession` to `CANCELLED` and, if the underlying `WorkflowInstance` is still
tracked, calls `workflowRuntime.cancel()` on it too — see Known Limitations for the
mid-flight caveat.

## Compensation Flow (interface only)

`ICompensationManager` (`compensation/i-compensation-manager.ts`) declares
`CompensationAction`/`RollbackAction`/`RecoveryAction` plus `compensate()`/`rollback()`/
`recover()` methods. **No class in this package implements it** and nothing drives a
Session from `FAILED` to `COMPENSATING` automatically — `runOperation("compensate")` exists
on the state machine but is never called by `executeWorkflow()` itself.

## Metrics

```
ExecutionMetricsCollector
├── executionCount / completedCount / failedCount / runningCount
├── averageDurationMs        (mean of completed Execution durations)
├── retryCount / timeoutCount / cancellationCount
└── averageOperationLatencyMs (per lifecycle-operation mean, via MetricsMiddleware)
```

## Health Check

`ExecutionHealth.check()` returns `{ status, executionQueue, runningWorkflow,
waitingWorkflow, deadWorkflow, checkpoint }` — `runningWorkflow` is derived from the live
failure ratio (>50% → unhealthy, >10% → degraded); the other four components default
`healthy` until `recordError(component, message)` is called, and heal back via
`clearError(component)`. Overall `status` is the worst status across all five.

## Folder Structure

| Folder           | Contents                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `token/`         | `ExecutionToken` (immutable: workflowExecutionId/tenantId/workflowInstanceId/executionId/startedAt/traceId/correlationId) |
| `context/`       | `ExecutionContext`, `ExecutionMode` (10 values), `ExecutionMetadata`, `ExecutionTimeouts`                                 |
| `cursor/`        | `ExecutionCursor`, `advanceCursor()`, `incrementLoopIteration()`                                                          |
| `graph/`         | `ExecutionGraph`/`buildExecutionGraph()`, `graph-analyzer.ts` (cycle/dead-end/orphan/infinite-loop detection)             |
| `state-machine/` | `ExecutionState` (11 values), `ExecutionStateMachine`                                                                     |
| `transition/`    | `TransitionEngine` (Success/Failure/Timeout/Cancelled/Retry/Manual/Condition outcomes)                                    |
| `retry/`         | `RetryPolicy`/`RetryStrategy`, `RetryCoordinator`                                                                         |
| `checkpoint/`    | `ExecutionCheckpoint`, `ICheckpointStore` (interface only)                                                                |
| `compensation/`  | `ICompensationManager` (interface only)                                                                                   |
| `capability/`    | `ICapabilityExecutor` (interface only — implementation belongs to 005.9)                                                  |
| `validator/`     | Execution/Graph/Transition/Node/Timeout/Retry validators + `ExecutionValidationPipeline`                                  |
| `middleware/`    | `ExecutionMiddlewarePipeline` + Validation/Permission/Tracing/Metrics/Logging/Lifecycle stages                            |
| `events/`        | `ExecutionEventPublisher` — publishes onto `@aos/event-bus`, 12 named event types                                         |
| `metrics/`       | `ExecutionMetricsCollector`                                                                                               |
| `health/`        | `ExecutionHealth`                                                                                                         |
| `monitoring/`    | `ExecutionMonitor` — Timeline/Tree/Trace views, re-exports `@aos/event-bus`'s Tracing port                                |
| `result/`        | `ExecutionResult`, `ExecutionHistory`/`ExecutionHistoryEntry`, `ExecutionStatistics`                                      |
| `engine/`        | `WorkflowExecutionEngine` — the public façade (only export), `ExecutionSession`                                           |
| `bootstrap/`     | `WorkflowExecutionSystem` — implements `@aos/runtime-kernel`'s `IModule`                                                  |
| `errors/`        | `WorkflowExecutionException` + 8 concrete subclasses                                                                      |

## Event Bus namespace

`workflow.execution.started`, `.completed`, `.failed`, `.timeout`, `.cancelled`,
`workflow.node.started`, `.completed`, `.failed`, `.retry`, `.timeout`, `.skipped`,
`.waiting` — every one published via the real `@aos/event-bus` `IPublisher`.

## Known Limitations

- **No Expression Evaluator exists in AOS today** — `CONDITION`-kind Transitions and
  `Manual` (Manual Approval) outcomes are both resolved structurally/unconditionally, not
  by evaluating an actual condition or waiting for a real human approval signal.
- **"Parallel" Execution Mode is simulated, not concurrent** — a fan-out's Nodes are
  processed sequentially within one `frontier` round in `runGraph()`.
- **No real Retry delay is ever awaited** — `computeDelayMs()` is a pure function callers
  could use to schedule a delay, but `executeNodeWithRetry()`'s loop calls the next
  attempt immediately.
- **A Loop Node backed by a real `@aos/node-runtime` Node Instance currently cannot
  execute end-to-end** — `@aos/node-runtime`'s built-in `LOOP` manifest requires a
  `config.condition` string, but `derive-config-from-definition-node.ts` (in
  `@aos/node-runtime`, not modifiable here) cannot derive one from a WDL Loop Node's
  structured `loopCondition` Expression. `executeWorkflow()` surfaces this as a thrown
  `NodeValidationException` from `@aos/node-runtime` today.
- **Cancelling/pausing an Execution mid-flight does not stop the in-flight Node step** —
  `executeWorkflow()` does not poll for cancellation between Node steps, so a Node already
  running when `cancel()` is called still runs to completion; if the underlying
  `WorkflowInstance` was genuinely cancelled, the Engine's own later `complete()` call on
  it will then fail (a real, observable inconsistency — not silently swallowed).
- **Checkpoint/Compensation remain interface-only** — no storage backend, no automatic
  compensation trigger.

## Future Integration

`ICapabilityExecutor`, `ICheckpointStore`, and `ICompensationManager` are this package's
three extension points for later Engineering Tasks — 005.9 (Capability/Tool/Connector
execution) is expected to supply a concrete `ICapabilityExecutor`; a future task supplies
the Checkpoint store and Compensation driver. See
`docs/005.6D-WORKFLOW-EXECUTION-ENGINE-REPORT.md` for the full readiness checklist handed
to 005.6E (Workflow Integration).

## Persistence

None. The internal Execution Coordinator (`engine/execution-coordinator.ts`) is in-memory
only.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.6D-WORKFLOW-EXECUTION-ENGINE-REPORT.md` for coverage numbers, known limitations,
and the readiness checklist for Engineering Task 005.6E (Workflow Integration) — **not
implemented in this package**.
