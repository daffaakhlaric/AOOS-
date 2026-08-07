import type { AdjacencyList, TaxonomyCoverageEntry } from "../types/knowledge-item.js";

export interface OrphanKnowledgeItem {
  readonly itemId: string;
}

/**
 * Real set-difference/graph-connectivity gap detection over caller-supplied structured input.
 * This package does not own a graph itself — orphan detection simply inspects a caller-supplied
 * adjacency list for nodes with zero edges (in either direction), which is plain data-structure
 * logic, not a reimplementation of `knowledge-graph`.
 */
export class KnowledgeGapAnalyzer {
  findGaps(taxonomy: readonly TaxonomyCoverageEntry[]): readonly TaxonomyCoverageEntry[] {
    return taxonomy.filter((entry) => !entry.covered);
  }

  findOrphans(
    itemIds: readonly string[],
    adjacency: AdjacencyList,
  ): readonly OrphanKnowledgeItem[] {
    const connected = new Set<string>();
    for (const [source, targets] of Object.entries(adjacency)) {
      if (targets.length > 0) connected.add(source);
      for (const target of targets) connected.add(target);
    }
    return itemIds.filter((id) => !connected.has(id)).map((itemId) => ({ itemId }));
  }
}
