import { InvalidSampleException } from "../../errors/invalid-sample-exception.js";
import { KnowledgeDashboardSnapshotFactory } from "../../factories/knowledge-dashboard-snapshot-factory.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/**
 * Stage 5 — Generate Dashboard Snapshot: builds an immutable `KnowledgeDashboardSnapshot` capturing
 * every numeric KPI computed by stage 3, as a single point-in-time read across all analytics
 * services.
 */
export class GenerateDashboardSnapshotStage implements PipelineStage {
  readonly name = "GenerateDashboardSnapshot";
  private readonly factory = new KnowledgeDashboardSnapshotFactory();

  execute(context: PipelineContext): PipelineContext {
    if (!context.kpis) {
      throw new InvalidSampleException(
        "GenerateDashboardSnapshot ran before CalculateKPIs populated `kpis`",
      );
    }

    const metrics: Record<string, number> = {};
    for (const [id, value] of Object.entries(context.kpis)) {
      if (typeof value === "number" && Number.isFinite(value)) metrics[id] = value;
    }

    const dashboardSnapshot = this.factory.create({ generatedAt: context.clock(), metrics });
    context.statistics.recordDashboardSnapshotGenerated();

    return { ...context, dashboardSnapshot };
  }
}
