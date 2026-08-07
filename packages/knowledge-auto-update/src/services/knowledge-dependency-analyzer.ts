import type { KnowledgeUpdateJob } from "../entities/knowledge-update-job.js";
import { topologicalSort, type DependencyEdge } from "../utils/topological-sort.js";

/**
 * Real dependency-graph-aware ordering for jobs: builds `from -> to` edges out of each job's
 * `dependsOn` list (dependency runs before dependent) and computes a valid execution order via
 * topological sort, detecting cycles as an error condition (`DependencyCycleException`).
 */
export class KnowledgeDependencyAnalyzer {
  order(jobs: readonly KnowledgeUpdateJob[]): string[] {
    const ids = jobs.map((j) => j.id);
    const idSet = new Set(ids);
    const edges: DependencyEdge[] = [];
    for (const job of jobs) {
      for (const dep of job.dependsOn) {
        // Dependencies outside this batch are assumed already satisfied (e.g. completed in a
        // prior run) and are not part of the ordering constraint for this batch.
        if (idSet.has(dep)) edges.push({ from: dep, to: job.id });
      }
    }
    return topologicalSort(ids, edges);
  }
}
