# @aos/node-runtime

The AOS Enterprise Node Runtime — validates Nodes, creates Node Instances, and manages
Node lifecycle for every Node Type/Category, including a full **AI Native Node System**
contract set. **This is not a workflow engine.** This package never executes a workflow
graph, a Capability, a Tool, or a Connector — see
`docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md` for the explicit scope boundary and
`docs/005.6C-ENTERPRISE-NODE-RUNTIME-REPORT.md` for the readiness checklist handed to
005.6D (Workflow Execution Engine).

## Public API

**Expose ONLY `NodeRuntime`.** Everything else in this package is an internal
implementation detail. The root export also carries the minimal data-contract surface
(types/interfaces/enums/errors) required to actually call `NodeRuntime`'s methods and
interpret their results — see `src/index.ts`'s own doc comment for the exact boundary.

## Quick example

```ts
import { EventBroker } from "@aos/event-bus";
import { NodeRuntime, NodeRuntimeEventPublisher, NodeType } from "@aos/node-runtime";

const bus = new EventBroker();
const runtime = new NodeRuntime({ eventPublisher: new NodeRuntimeEventPublisher(bus) });

const execution = await runtime.createFromRegistry({
  workflowInstanceId: "wf-instance-1",
  nodeId: "send-crm-lead",
  type: NodeType.CAPABILITY,
  config: { capabilityId: "crm.create" },
});

await runtime.initialize(execution.instance.id);
await runtime.start(execution.instance.id);
await runtime.complete(execution.instance.id); // publishes node.completed
```

## Architecture: Factory/Resolver/Validator → Middleware Pipeline → State Machine → Events

`NodeRuntime` (`runtime/node-runtime.ts`) is the composition root:

1. **`createFromDefinition()`/`createFromRegistry()`/`createFromBlueprint()`** each build
   a `NodeInstance` (`factory/`), resolve its Manifest (`resolver/`, `registry/`), and
   validate it (`validator/`) before registering it.
2. **`initialize()`/`validate()`/`prepare()`/`start()`/`pause()`/`resume()`/`complete()`/
   `fail()`/`cancel()`/`timeout()`** each dispatch through the **Node Middleware
   Pipeline** (`middleware/`) — Validation → Permission → Tracing → Metrics → Logging →
   Lifecycle (terminal) — before the **State Machine** (`lifecycle/node-state-machine.ts`)
   applies the actual `NodeState` transition.
3. Every operation is addressed by Node Instance **id** alone — never by scanning for a
   matching state.
4. Every state-changing call ends by publishing the matching `node.*` event via
   `NodeRuntimeEventPublisher` onto the real `@aos/event-bus`.

## AI Native Node System

Beyond the 24 "Flow Node" types, this package designs 12 **contract-only** AI-native Node
Types (`contracts/ai-native/`) — schema + manifest + registry integration + lifecycle,
**no execution**: `AIPlannerNode`, `AIReasonNode`, `AIReflectionNode`, `AICriticNode`,
`AIDebateNode`, `AIVotingNode`, `AIConsensusNode`, `AISimulationNode`, `PromptNode`,
`KnowledgeSearchNode`, `CapabilityNode`, `HumanApprovalNode`. A future Agent Runtime
(005.14) composes workflows out of these Node Types instead of embedding its own planning/
reasoning/consensus logic — all orchestration stays in the Workflow Engine.

## Node State

Created → Ready → Running ⇄ (Waiting | Paused) → Completed | Cancelled | Skipped |
TimedOut | Failed → Compensated. See `contracts/node-state.ts`'s
`NODE_STATE_TRANSITIONS` for the authoritative table.

## Folder Structure

| Folder        | Contents                                                                                                                                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contracts/`  | `NodeType` (35 values), `NodeCategory`, `NodeState`, `ExecutionMode`, `NodeManifest`, `ai-native/` (12 AI-native contracts), `i-node-executor.ts`/`i-ai-node.ts`/`i-knowledge-node.ts`/`i-memory-node.ts` (interfaces only) |
| `instance/`   | `NodeInstance`, `NodeExecution`, `NodeMetadata`, `NodeHistory`, `NodeResult`, `NodeSnapshot`                                                                                                                                |
| `context/`    | `NodeContext`                                                                                                                                                                                                               |
| `registry/`   | `NodeRegistry` — wraps `@aos/workflow-definition`'s `SchemaRegistry`, no duplicated storage                                                                                                                                 |
| `resolver/`   | `NodeResolver` — resolves Node Type/Version/Definition                                                                                                                                                                      |
| `factory/`    | `NodeFactory` — creates from Workflow Definition / Registry / Blueprint                                                                                                                                                     |
| `validator/`  | Schema/Configuration/Compatibility/Input-Output/Dependency/Version validators + `ValidationPipeline`                                                                                                                        |
| `lifecycle/`  | `NodeStateMachine`, `NodeLifecycleManager`; `compensate()` is interface-only                                                                                                                                                |
| `middleware/` | `NodeMiddlewarePipeline` + Validation/Permission/Tracing/Metrics/Logging/Lifecycle stages                                                                                                                                   |
| `events/`     | `NodeRuntimeEventPublisher` — publishes onto `@aos/event-bus`                                                                                                                                                               |
| `metrics/`    | `NodeRuntimeMetricsCollector`                                                                                                                                                                                               |
| `health/`     | `NodeRuntimeHealth` — Runtime/Registry/Factory/Validator/Resolver Health                                                                                                                                                    |
| `monitoring/` | `NodeRuntimeMonitor` — re-exports `@aos/event-bus`'s Tracing port                                                                                                                                                           |
| `runtime/`    | `NodeRuntime` — the public façade (only export)                                                                                                                                                                             |
| `bootstrap/`  | `NodeRuntimeSystem` — implements `@aos/runtime-kernel`'s `IModule`                                                                                                                                                          |
| `errors/`     | `NodeRuntimeException` + 8 concrete subclasses                                                                                                                                                                              |

## Event Bus namespace

`node.created`, `.initialized`, `.started`, `.completed`, `.failed`, `.cancelled`,
`.timeout`, `.state.changed` — every one published via the real `@aos/event-bus`
`IPublisher`.

## Persistence

None. The internal Node Execution Coordinator is in-memory only.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.6C-ENTERPRISE-NODE-RUNTIME-REPORT.md` for coverage numbers, known limitations,
and the readiness checklist for Engineering Task 005.6D (Workflow Execution Engine) —
**not implemented in this package**.
