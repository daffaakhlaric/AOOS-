import { TransitionKind, type WorkflowDefinition } from "@aos/workflow-definition";

export interface ExecutionGraphEdge {
  readonly transitionId: string;
  readonly kind: TransitionKind;
  readonly fromNodeId: string;
  readonly toNodeId: string;
}

/**
 * "EXECUTION GRAPH: Build runtime graph." (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md).
 * A purpose-built runtime adjacency structure for this package's own Node-by-Node walk —
 * distinct from (and not a duplicate of) `@aos/workflow-definition`'s own structural
 * schema validation; this graph exists to be walked at execution time.
 */
export interface ExecutionGraph {
  readonly nodeIds: readonly string[];
  readonly startNodeId: string;
  readonly endNodeIds: ReadonlySet<string>;
  readonly loopNodeIds: ReadonlySet<string>;
  readonly edgesByFromNode: ReadonlyMap<string, readonly ExecutionGraphEdge[]>;
  readonly edgesByToNode: ReadonlyMap<string, readonly ExecutionGraphEdge[]>;
}

function nodeTypeIsStart(type: string): boolean {
  return type === "start";
}

function nodeTypeIsEnd(type: string): boolean {
  return type === "end";
}

function nodeTypeIsLoop(type: string): boolean {
  return type === "loop";
}

/** Builds the runtime `ExecutionGraph` from a validated `WorkflowDefinition` (already schema-valid — this package assumes `@aos/workflow-definition`'s own Validation Pipeline has run). */
export function buildExecutionGraph(definition: WorkflowDefinition): ExecutionGraph {
  const nodeIds = definition.nodes.map((node) => node.id);
  const startNode = definition.nodes.find((node) => nodeTypeIsStart(node.type));
  const endNodeIds = new Set(
    definition.nodes.filter((node) => nodeTypeIsEnd(node.type)).map((node) => node.id),
  );
  const loopNodeIds = new Set(
    definition.nodes.filter((node) => nodeTypeIsLoop(node.type)).map((node) => node.id),
  );

  const edgesByFromNode = new Map<string, ExecutionGraphEdge[]>();
  const edgesByToNode = new Map<string, ExecutionGraphEdge[]>();
  for (const transition of definition.transitions ?? []) {
    const edge: ExecutionGraphEdge = {
      transitionId: transition.id,
      kind: transition.kind,
      fromNodeId: transition.fromNodeId,
      toNodeId: transition.toNodeId,
    };
    const outgoing = edgesByFromNode.get(edge.fromNodeId) ?? [];
    outgoing.push(edge);
    edgesByFromNode.set(edge.fromNodeId, outgoing);

    const incoming = edgesByToNode.get(edge.toNodeId) ?? [];
    incoming.push(edge);
    edgesByToNode.set(edge.toNodeId, incoming);
  }

  // A Loop Node's `bodyNodeId` is a structural edge even without an explicit Transition —
  // mirrors `@aos/workflow-definition`'s `CycleValidator` treatment of Loop bodies.
  for (const node of definition.nodes) {
    if (node.type === "loop") {
      const loopEdge: ExecutionGraphEdge = {
        transitionId: `__loop_body__:${node.id}`,
        kind: TransitionKind.LOOP,
        fromNodeId: node.id,
        toNodeId: node.bodyNodeId,
      };
      const outgoing = edgesByFromNode.get(node.id) ?? [];
      outgoing.push(loopEdge);
      edgesByFromNode.set(node.id, outgoing);

      const bodyIncoming = edgesByToNode.get(node.bodyNodeId) ?? [];
      bodyIncoming.push(loopEdge);
      edgesByToNode.set(node.bodyNodeId, bodyIncoming);

      const backEdge: ExecutionGraphEdge = {
        transitionId: `__loop_return__:${node.id}`,
        kind: TransitionKind.LOOP,
        fromNodeId: node.bodyNodeId,
        toNodeId: node.id,
      };
      const bodyOutgoing = edgesByFromNode.get(node.bodyNodeId) ?? [];
      bodyOutgoing.push(backEdge);
      edgesByFromNode.set(node.bodyNodeId, bodyOutgoing);

      const loopIncoming = edgesByToNode.get(node.id) ?? [];
      loopIncoming.push(backEdge);
      edgesByToNode.set(node.id, loopIncoming);
    }
  }

  return {
    nodeIds,
    startNodeId: startNode?.id ?? "",
    endNodeIds,
    loopNodeIds,
    edgesByFromNode,
    edgesByToNode,
  };
}
