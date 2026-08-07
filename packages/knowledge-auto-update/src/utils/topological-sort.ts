import { DependencyCycleException } from "../errors/dependency-cycle-exception.js";

import { PriorityQueue } from "./priority-queue.js";

/** A directed edge `from -> to` meaning "`from` must run before `to`". */
export interface DependencyEdge {
  readonly from: string;
  readonly to: string;
}

/**
 * Kahn's algorithm: computes a valid execution order over `nodes` given `edges` (`from` before
 * `to`). Deterministic tie-breaking: among nodes with no remaining incoming edges, the one that
 * appears earliest in the original `nodes` array is emitted first. Throws
 * `DependencyCycleException` (naming the cyclic nodes) if no valid order exists.
 */
export function topologicalSort(
  nodes: readonly string[],
  edges: readonly DependencyEdge[],
): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    inDegree.set(node, 0);
    adjacency.set(node, []);
  }
  for (const edge of edges) {
    if (!inDegree.has(edge.from) || !inDegree.has(edge.to)) {
      throw new DependencyCycleException([edge.from, edge.to]);
    }
    adjacency.get(edge.from)!.push(edge.to);
    inDegree.set(edge.to, inDegree.get(edge.to)! + 1);
  }

  const remaining = new Set(nodes);
  const result: string[] = [];

  while (remaining.size > 0) {
    const ready = nodes.filter((n) => remaining.has(n) && inDegree.get(n) === 0);
    if (ready.length === 0) {
      throw new DependencyCycleException([...remaining]);
    }
    const chosen = ready[0]!;
    result.push(chosen);
    remaining.delete(chosen);
    for (const next of adjacency.get(chosen)!) {
      inDegree.set(next, inDegree.get(next)! - 1);
    }
  }

  return result;
}

/**
 * A priority-aware generalization of Kahn's algorithm: same dependency-ordering guarantee as
 * `topologicalSort` (every `from` precedes its `to`), but whenever more than one node is ready
 * (in-degree 0) at once, the one with the HIGHEST `priorityOf(node)` is emitted next (ties broken
 * FIFO by original `nodes` order). This is what `KnowledgeUpdateScheduler` uses to combine
 * dependency-aware scheduling with priority-queue scheduling in a single, correct pass.
 */
export function priorityTopologicalSort(
  nodes: readonly string[],
  edges: readonly DependencyEdge[],
  priorityOf: (node: string) => number,
): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const order = new Map<string, number>();
  nodes.forEach((node, index) => {
    inDegree.set(node, 0);
    adjacency.set(node, []);
    order.set(node, index);
  });
  for (const edge of edges) {
    if (!inDegree.has(edge.from) || !inDegree.has(edge.to)) {
      throw new DependencyCycleException([edge.from, edge.to]);
    }
    adjacency.get(edge.from)!.push(edge.to);
    inDegree.set(edge.to, inDegree.get(edge.to)! + 1);
  }

  // Higher priority first; ties broken by original array position (stable FIFO).
  const ready = new PriorityQueue<string>((a, b) => {
    const diff = priorityOf(b) - priorityOf(a);
    return diff !== 0 ? diff : order.get(a)! - order.get(b)!;
  });
  for (const node of nodes) {
    if (inDegree.get(node) === 0) ready.enqueue(node);
  }

  const result: string[] = [];
  const emitted = new Set<string>();
  while (!ready.isEmpty()) {
    const node = ready.dequeue()!;
    result.push(node);
    emitted.add(node);
    for (const next of adjacency.get(node)!) {
      const remaining = inDegree.get(next)! - 1;
      inDegree.set(next, remaining);
      if (remaining === 0) ready.enqueue(next);
    }
  }

  if (result.length !== nodes.length) {
    throw new DependencyCycleException(nodes.filter((n) => !emitted.has(n)));
  }

  return result;
}
