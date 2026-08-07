import {
  analyzeImpact,
  findDependencies,
  findDependents,
  type ImpactAnalysisResult,
} from "../reasoning/index.js";

import type { GraphSystemContext } from "./graph-system-context.js";

/**
 * Owns the reasoning-shaped Graph Operations: Find Dependencies, Find Dependents, Impact
 * Analysis — all defined over the dependency edge-type family (`DependsOn`, `Uses`, `Calls`,
 * `References`, see `edges/edge-type-semantics.ts`).
 */
export class ReasoningManager {
  constructor(private readonly ctx: GraphSystemContext) {}

  findDependencies(graphId: string, nodeId: string): string[] {
    const engine = this.ctx.graphRegistry.get(graphId);
    return findDependencies(engine, nodeId);
  }

  findDependents(graphId: string, nodeId: string): string[] {
    const engine = this.ctx.graphRegistry.get(graphId);
    return findDependents(engine, nodeId);
  }

  impactAnalysis(graphId: string, nodeId: string): ImpactAnalysisResult {
    const engine = this.ctx.graphRegistry.get(graphId);
    return analyzeImpact(engine, nodeId);
  }
}
