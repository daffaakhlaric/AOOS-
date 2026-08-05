# @aos/workflow-definition

The AOS Workflow Definition Language (**AOS-WDL**) — contracts, schema, node/transition/
variable model, expression interfaces, parser, serializer, validator, builder, versioning,
and registry for Workflow Definitions. **Not BPMN. Not Camunda. Not Temporal DSL.** This
package _defines_ Workflows; it never executes them — see
`docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md` for the explicit scope boundary.

## Quick example

```ts
import { EventBroker } from "@aos/event-bus";
import {
  WorkflowBuilder,
  NodeType,
  TransitionKind,
  WorkflowDefinitionEventPublisher,
  WorkflowDefinitionService,
  ValidationPipeline,
  YamlWorkflowDefinitionSerializer,
} from "@aos/workflow-definition";

const bus = new EventBroker();
const service = new WorkflowDefinitionService({
  eventPublisher: new WorkflowDefinitionEventPublisher(bus),
});

const workflow = WorkflowBuilder.create("order-fulfillment", "1.0.0")
  .withDisplayName("Order Fulfillment")
  .addNode({ id: "start", name: "Start", type: NodeType.START })
  .addNode({
    id: "ship",
    name: "Ship Order",
    type: NodeType.CAPABILITY,
    capability: "shipping.dispatch",
  })
  .addNode({ id: "end", name: "End", type: NodeType.END })
  .addTransition({ id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "ship" })
  .addTransition({ id: "t-2", kind: TransitionKind.NEXT, fromNodeId: "ship", toNodeId: "end" })
  .build();

const { valid, issues } = new ValidationPipeline().run(workflow);
if (!valid) throw new Error(issues.map((i) => i.message).join("; "));

await service.createDefinition(workflow); // publishes workflow.definition.created
console.log(new YamlWorkflowDefinitionSerializer().serialize(workflow)); // Import/Export
```

## Architecture: Schema → Validator → Builder/Parser/Serializer → Registry → Events

`workflowDefinitionSchema` (`schemas/workflow-definition.ts`) is the single source of
truth every other module composes around:

1. **Shape validation** happens once, at the boundary — `JsonWorkflowDefinitionParser` /
   `YamlWorkflowDefinitionParser` (`parser/`) parse text into a candidate object and run it
   through the Zod schema; `WorkflowBuilder`/`NodeBuilder`/`TransitionBuilder`/
   `VariableBuilder` (`builder/`) do the same at `.build()`.
2. **Structural/semantic validation** — the rules Zod's shape alone cannot express — is a
   `ValidationPipeline` (`validator/`) of eight small, independent `IWorkflowValidator`s
   (Structural → Transition → Duplicate → Cycle → Variable → Expression → Version →
   Permission), aggregating every issue rather than stopping at the first.
3. **Serialization** (`serializer/`) is the exact inverse of parsing — YAML and JSON, both
   round-trip losslessly against the schema (Import/Export Flow).
4. **Registry** (`registry/`) is the in-memory store: `WorkflowDefinitionRegistry` composes
   an internal `VersionRegistry` (sorted SemVer list per id) and exposes an independent
   `SchemaRegistry` (the extension point for a future custom Node/Expression Type).
5. **Versioning** (`versioning/`) — `CompatibilityChecker` runs a real structural diff
   between two versions of the same Workflow (id, SemVer ordering, removed `input` fields,
   removed Node ids); `IWorkflowMigration` is an interface only, no implementation.
6. **Events** (`events/`) — `WorkflowDefinitionEventPublisher` publishes
   `workflow.definition.*` onto the real `@aos/event-bus` `IPublisher`.
7. **Bootstrap** (`bootstrap/`) — `WorkflowDefinitionService` ties the Registry to Event
   Publishing (every mutation and every explicit validation run publishes the matching
   event); `WorkflowDefinitionSystem` wraps it as an `@aos/runtime-kernel` `IModule`.

## 13 Node Types

Start, End, Task, Capability, Condition, Decision, Parallel, Merge, Loop, Delay, Wait,
Human, SubWorkflow — a 13-way Zod discriminated union (`nodes/node.ts`). Event, AI, and
Script Node Types are explicitly future work (see `SchemaRegistry`'s extension point).

## Folder Structure

| Folder         | Contents                                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `contracts/`   | `NodeType`, `TransitionKind`, `VariableScope`, `ExpressionType`, `WorkflowDefinitionStatus` + transitions, Retry/Timeout/Compensation contracts, `TenantScope`, `ISignatureProvider` |
| `variables/`   | `VariableType`, `VariableDeclaration`                                                                                                                                                |
| `expressions/` | 8 Expression types (Literal/VariableRef/CapabilityRef/Comparison/Boolean/Arithmetic/String/Date) as a recursive Zod discriminated union — interfaces only, never evaluated           |
| `transitions/` | `Transition` schema                                                                                                                                                                  |
| `nodes/`       | `baseNodeSchema` + the 13 concrete Node schemas + the discriminated union                                                                                                            |
| `metadata/`    | Labels, Tags, free-form Workflow Metadata                                                                                                                                            |
| `schemas/`     | `workflowDefinitionSchema` (the Workflow Root) + Error Handling                                                                                                                      |
| `errors/`      | `WorkflowDefinitionException` + 8 concrete subclasses                                                                                                                                |
| `parser/`      | `JsonWorkflowDefinitionParser`, `YamlWorkflowDefinitionParser`                                                                                                                       |
| `serializer/`  | `JsonWorkflowDefinitionSerializer`, `YamlWorkflowDefinitionSerializer`                                                                                                               |
| `validator/`   | 8 `IWorkflowValidator`s + `ValidationPipeline`, `expression-walker` (collectExpressions/walkExpression)                                                                              |
| `builder/`     | `WorkflowBuilder`, `NodeBuilder`, `TransitionBuilder`, `VariableBuilder`, `ValidationBuilder`                                                                                        |
| `versioning/`  | `CompatibilityChecker`, `IWorkflowMigration` (interface only)                                                                                                                        |
| `registry/`    | `WorkflowDefinitionRegistry`, `VersionRegistry`, `SchemaRegistry`                                                                                                                    |
| `events/`      | `WorkflowDefinitionEventPublisher` — publishes onto `@aos/event-bus`                                                                                                                 |
| `config/`      | `WorkflowDefinitionConfig`                                                                                                                                                           |
| `bootstrap/`   | `WorkflowDefinitionService`, `WorkflowDefinitionSystem` (implements `IModule`)                                                                                                       |
| `utils/`       | `generateId()`                                                                                                                                                                       |

## Event Bus namespace

`workflow.definition.created`, `.updated`, `.deleted`, `.validated`, `.versioned` — every
one published via the real `@aos/event-bus` `IPublisher`, carrying definition metadata
only (id/version/name/nodeCount), never anything execution-related.

## Persistence

None. `WorkflowDefinitionRegistry` is in-memory only — a durable store is future work
behind the existing `IWorkflowDefinitionRegistry` interface.

## Testing

Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`. See
`docs/005.6A-WORKFLOW-DEFINITION-LANGUAGE-REPORT.md` for coverage numbers, known
limitations, and the readiness checklist for Engineering Task 005.6B (Workflow Runtime
Core) — **not implemented in this package**.
