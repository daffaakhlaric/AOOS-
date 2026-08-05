import {
  ExpressionType,
  NodeType,
  TransitionKind,
  WorkflowBuilder,
  type WorkflowDefinition,
} from "@aos/workflow-definition";

/** Start -> Capability -> End, a straightforward Sequential Execution Mode fixture. */
export function definitionFixture(
  overrides: { readonly id?: string; readonly version?: string } = {},
): WorkflowDefinition {
  return WorkflowBuilder.create(overrides.id ?? "sample-workflow", overrides.version ?? "1.0.0")
    .withDisplayName("Sample Workflow")
    .addNode({ id: "start", name: "Start", type: NodeType.START })
    .addNode({
      id: "cap-1",
      name: "Do capability",
      type: NodeType.CAPABILITY,
      capability: "crm.create",
    })
    .addNode({ id: "end", name: "End", type: NodeType.END })
    .addTransition({ id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "cap-1" })
    .addTransition({ id: "t-2", kind: TransitionKind.NEXT, fromNodeId: "cap-1", toNodeId: "end" })
    .build();
}

/** Start -> Human -> End, with no Capability Node, so it completes without an `ICapabilityExecutor`. */
export function humanDefinitionFixture(): WorkflowDefinition {
  return WorkflowBuilder.create("human-workflow", "1.0.0")
    .addNode({ id: "start", name: "Start", type: NodeType.START })
    .addNode({ id: "human-1", name: "Approve", type: NodeType.HUMAN })
    .addNode({ id: "end", name: "End", type: NodeType.END })
    .addTransition({
      id: "t-1",
      kind: TransitionKind.NEXT,
      fromNodeId: "start",
      toNodeId: "human-1",
    })
    .addTransition({ id: "t-2", kind: TransitionKind.NEXT, fromNodeId: "human-1", toNodeId: "end" })
    .build();
}

/** Start -> Loop(body: Task) -> End, exercising bounded Loop Node iteration. */
export function loopDefinitionFixture(): WorkflowDefinition {
  return WorkflowBuilder.create("loop-workflow", "1.0.0")
    .addNode({ id: "start", name: "Start", type: NodeType.START })
    .addNode({
      id: "loop-1",
      name: "Loop",
      type: NodeType.LOOP,
      loopCondition: { type: ExpressionType.LITERAL, value: true },
      bodyNodeId: "body-1",
    })
    .addNode({ id: "body-1", name: "Body", type: NodeType.TASK })
    .addNode({ id: "end", name: "End", type: NodeType.END })
    .addTransition({
      id: "t-1",
      kind: TransitionKind.NEXT,
      fromNodeId: "start",
      toNodeId: "loop-1",
    })
    .addTransition({ id: "t-2", kind: TransitionKind.NEXT, fromNodeId: "loop-1", toNodeId: "end" })
    .build();
}

/** Start -> Capability -> [Failure] -> Recovery -> End; also a plain End for the success path. */
export function failureTransitionDefinitionFixture(): WorkflowDefinition {
  return WorkflowBuilder.create("failure-transition-workflow", "1.0.0")
    .addNode({ id: "start", name: "Start", type: NodeType.START })
    .addNode({
      id: "cap-1",
      name: "Do capability",
      type: NodeType.CAPABILITY,
      capability: "crm.create",
    })
    .addNode({ id: "recovery", name: "Recovery", type: NodeType.TASK })
    .addNode({ id: "end", name: "End", type: NodeType.END })
    .addTransition({ id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "cap-1" })
    .addTransition({ id: "t-2", kind: TransitionKind.NEXT, fromNodeId: "cap-1", toNodeId: "end" })
    .addTransition({
      id: "t-3",
      kind: TransitionKind.FAILURE,
      fromNodeId: "cap-1",
      toNodeId: "recovery",
    })
    .addTransition({
      id: "t-4",
      kind: TransitionKind.NEXT,
      fromNodeId: "recovery",
      toNodeId: "end",
    })
    .build();
}

/** Start -> Fork(cap-a, cap-b) -> End — two Capability Nodes reachable via PARALLEL Transitions, both merging into End. */
export function parallelDefinitionFixture(): WorkflowDefinition {
  return WorkflowBuilder.create("parallel-workflow", "1.0.0")
    .addNode({ id: "start", name: "Start", type: NodeType.START })
    .addNode({ id: "cap-a", name: "Branch A", type: NodeType.CAPABILITY, capability: "crm.create" })
    .addNode({ id: "cap-b", name: "Branch B", type: NodeType.CAPABILITY, capability: "crm.update" })
    .addNode({ id: "end", name: "End", type: NodeType.END })
    .addTransition({
      id: "t-1",
      kind: TransitionKind.PARALLEL,
      fromNodeId: "start",
      toNodeId: "cap-a",
    })
    .addTransition({
      id: "t-2",
      kind: TransitionKind.PARALLEL,
      fromNodeId: "start",
      toNodeId: "cap-b",
    })
    .addTransition({ id: "t-3", kind: TransitionKind.MERGE, fromNodeId: "cap-a", toNodeId: "end" })
    .addTransition({ id: "t-4", kind: TransitionKind.MERGE, fromNodeId: "cap-b", toNodeId: "end" })
    .build();
}

/** Start -> Capability -> End, with both a TIMEOUT-kind and a RETRY-kind Transition also leaving the Capability Node, for exercising `TransitionEngine`'s "timeout"/"retry" outcome resolution when a matching edge does exist. */
export function timeoutRetryDefinitionFixture(): WorkflowDefinition {
  return WorkflowBuilder.create("timeout-retry-workflow", "1.0.0")
    .addNode({ id: "start", name: "Start", type: NodeType.START })
    .addNode({
      id: "cap-1",
      name: "Do capability",
      type: NodeType.CAPABILITY,
      capability: "crm.create",
    })
    .addNode({ id: "timeout-handler", name: "Timeout Handler", type: NodeType.TASK })
    .addNode({ id: "retry-handler", name: "Retry Handler", type: NodeType.TASK })
    .addNode({ id: "end", name: "End", type: NodeType.END })
    .addTransition({ id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "cap-1" })
    .addTransition({ id: "t-2", kind: TransitionKind.NEXT, fromNodeId: "cap-1", toNodeId: "end" })
    .addTransition({
      id: "t-3",
      kind: TransitionKind.TIMEOUT,
      fromNodeId: "cap-1",
      toNodeId: "timeout-handler",
    })
    .addTransition({
      id: "t-4",
      kind: TransitionKind.RETRY,
      fromNodeId: "cap-1",
      toNodeId: "retry-handler",
    })
    .build();
}

/** A dead-end/orphan-laden Definition — a disconnected Node with no incoming Transition, and a non-End Node with no outgoing Transition. */
export function brokenDefinitionFixture(): WorkflowDefinition {
  return WorkflowBuilder.create("broken-workflow", "1.0.0")
    .addNode({ id: "start", name: "Start", type: NodeType.START })
    .addNode({ id: "dead-end", name: "Dead End", type: NodeType.TASK })
    .addNode({ id: "orphan", name: "Orphan", type: NodeType.TASK })
    .addNode({ id: "end", name: "End", type: NodeType.END })
    .addTransition({
      id: "t-1",
      kind: TransitionKind.NEXT,
      fromNodeId: "start",
      toNodeId: "dead-end",
    })
    .build();
}
