import type { GraphCluster } from "../domain/graph-cluster.js";
import type { GraphEngine } from "../graph/graph-engine.js";
import { generateId } from "../utils/index.js";

class UnionFind {
  private readonly parent = new Map<string, string>();

  makeSet(id: string): void {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    const parent = this.parent.get(id) ?? id;
    if (parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }
}

/**
 * Real connected-components computation via union-find (disjoint-set with path compression).
 * Edges are treated as undirected for component grouping — this is the standard definition of
 * "connected components" (weak connectivity) for a directed graph. `O((V + E) * α(V))`.
 */
export function findConnectedComponents(engine: GraphEngine): GraphCluster[] {
  const unionFind = new UnionFind();
  for (const node of engine.listNodes()) {
    unionFind.makeSet(node.id);
  }
  for (const edge of engine.listEdges()) {
    unionFind.union(edge.sourceNodeId, edge.targetNodeId);
  }

  const groups = new Map<string, string[]>();
  for (const node of engine.listNodes()) {
    const root = unionFind.find(node.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(node.id);
  }

  return Array.from(groups.values()).map((nodeIds) => ({
    id: generateId("cluster"),
    nodeIds,
    size: nodeIds.length,
  }));
}
