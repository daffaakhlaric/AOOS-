import type { KnowledgeUpdateJob } from "../entities/knowledge-update-job.js";

import { KnowledgeDependencyAnalyzer } from "./knowledge-dependency-analyzer.js";

export interface RefreshPlanStep {
  readonly jobId: string;
  readonly targetId: string;
  readonly sequence: number;
}

export interface RefreshPlan {
  readonly steps: readonly RefreshPlanStep[];
}

/**
 * Plans the sequence/scope of a refresh across a batch of jobs, given their dependency
 * information (delegates ordering to `KnowledgeDependencyAnalyzer`) and assigns each step a
 * 0-based sequence number reflecting that order.
 */
export class KnowledgeRefreshPlanner {
  private readonly dependencyAnalyzer: KnowledgeDependencyAnalyzer;

  constructor(dependencyAnalyzer: KnowledgeDependencyAnalyzer = new KnowledgeDependencyAnalyzer()) {
    this.dependencyAnalyzer = dependencyAnalyzer;
  }

  plan(jobs: readonly KnowledgeUpdateJob[]): RefreshPlan {
    const orderedIds = this.dependencyAnalyzer.order(jobs);
    const byId = new Map(jobs.map((j) => [j.id, j]));
    const steps = orderedIds.map((jobId, sequence) => ({
      jobId,
      targetId: byId.get(jobId)!.targetId,
      sequence,
    }));
    return { steps };
  }
}
