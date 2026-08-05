import { TransitionKind } from "@aos/workflow-definition";

import { TransitionResolutionException } from "../errors/transition-resolution-exception.js";

import type {
  ITransitionEngine,
  ResolvedTransition,
  ResolveTransitionInput,
} from "./i-transition-engine.js";

const STRUCTURAL_SUCCESS_KINDS: ReadonlySet<TransitionKind> = new Set([
  TransitionKind.NEXT,
  TransitionKind.CONDITION,
  TransitionKind.PARALLEL,
  TransitionKind.MERGE,
  // A Loop Node's body re-enters the Loop Node itself via a synthetic `LOOP`-kind edge
  // (`graph/execution-graph.ts`) — a non-Loop Node (i.e. the loop body) with such an edge
  // must still follow it on success. The Loop Node's *own* resolution is special-cased
  // above and never reaches this generic path.
  TransitionKind.LOOP,
]);

/** Resolves the Node(s) to visit next given the current Node's outcome — see `transition-outcome.ts` for the "Condition"/"Manual" simplifications. */
export class TransitionEngine implements ITransitionEngine {
  resolve(input: ResolveTransitionInput): ResolvedTransition {
    const { graph, cursor, outcome, maxLoopIterations = 1 } = input;
    const nodeId = cursor.currentNodeId;
    const outgoing = graph.edgesByFromNode.get(nodeId) ?? [];

    if (outcome === "cancelled") {
      return { nextNodeIds: [], isLoopBack: false };
    }

    if (outcome === "failure") {
      const failureEdges = outgoing.filter((edge) => edge.kind === TransitionKind.FAILURE);
      // No Failure Transition is a normal "business failure" completion — the caller
      // (`engine/workflow-execution-engine.ts#runGraph()`) turns an empty result into a
      // failed `ExecutionResult`, not a thrown exception.
      return {
        nextNodeIds: failureEdges.length > 0 ? failureEdges.map((edge) => edge.toNodeId) : [],
        isLoopBack: false,
      };
    }

    if (outcome === "timeout") {
      const timeoutEdges = outgoing.filter((edge) => edge.kind === TransitionKind.TIMEOUT);
      return {
        nextNodeIds: timeoutEdges.length > 0 ? timeoutEdges.map((edge) => edge.toNodeId) : [],
        isLoopBack: false,
      };
    }

    if (outcome === "retry") {
      const retryEdges = outgoing.filter((edge) => edge.kind === TransitionKind.RETRY);
      return {
        nextNodeIds: retryEdges.length > 0 ? retryEdges.map((edge) => edge.toNodeId) : [nodeId],
        isLoopBack: false,
      };
    }

    // "success" and "manual" (Manual Approval) both proceed down the normal path.
    if (graph.loopNodeIds.has(nodeId)) {
      const loopEdge = outgoing.find((edge) => edge.kind === TransitionKind.LOOP);
      const exitEdges = outgoing.filter((edge) => edge.kind !== TransitionKind.LOOP);
      const iterationCount = cursor.loopIterations[nodeId] ?? 0;
      if (loopEdge && iterationCount < maxLoopIterations) {
        return { nextNodeIds: [loopEdge.toNodeId], isLoopBack: true };
      }
      return { nextNodeIds: exitEdges.map((edge) => edge.toNodeId), isLoopBack: false };
    }

    const structuralEdges = outgoing.filter((edge) => STRUCTURAL_SUCCESS_KINDS.has(edge.kind));
    if (structuralEdges.length === 0) {
      if (graph.endNodeIds.has(nodeId)) {
        return { nextNodeIds: [], isLoopBack: false };
      }
      throw new TransitionResolutionException(
        `No outgoing Transition resolves outcome "${outcome}" from Node "${nodeId}"`,
      );
    }
    return { nextNodeIds: structuralEdges.map((edge) => edge.toNodeId), isLoopBack: false };
  }
}
