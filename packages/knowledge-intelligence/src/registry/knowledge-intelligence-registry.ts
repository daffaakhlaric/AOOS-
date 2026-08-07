import type { KnowledgeIntelligenceReport } from "../entities/knowledge-intelligence-report.js";
import type { KnowledgeIntelligenceSnapshot } from "../entities/knowledge-intelligence-snapshot.js";
import { InsightNotFoundException } from "../errors/insight-not-found-exception.js";
import { RecommendationNotFoundException } from "../errors/recommendation-not-found-exception.js";
import { ReportNotFoundException } from "../errors/report-not-found-exception.js";
import { SnapshotNotFoundException } from "../errors/snapshot-not-found-exception.js";
import type { KnowledgeInsight } from "../value-objects/knowledge-insight.js";
import type { KnowledgeRecommendation } from "../value-objects/knowledge-recommendation.js";

/**
 * Id-keyed, in-memory buckets for every entity/value-object this package tracks across runs.
 * Buckets: reports, snapshots, recommendations, insights — the four artifact kinds a host needs
 * to look back up by id after a pipeline run. All lookups are `Map.get` by id — never a linear
 * scan.
 */
export class KnowledgeIntelligenceRegistry {
  private readonly reports = new Map<string, KnowledgeIntelligenceReport>();
  private readonly snapshots = new Map<string, KnowledgeIntelligenceSnapshot>();
  private readonly recommendations = new Map<string, KnowledgeRecommendation>();
  private readonly insights = new Map<string, KnowledgeInsight>();

  // Reports
  putReport(report: KnowledgeIntelligenceReport): void {
    this.reports.set(report.id, report);
  }
  getReport(id: string): KnowledgeIntelligenceReport {
    const report = this.reports.get(id);
    if (!report) throw new ReportNotFoundException(id);
    return report;
  }
  findReport(id: string): KnowledgeIntelligenceReport | undefined {
    return this.reports.get(id);
  }
  listReports(): readonly KnowledgeIntelligenceReport[] {
    return [...this.reports.values()];
  }

  // Snapshots
  putSnapshot(snapshot: KnowledgeIntelligenceSnapshot): void {
    this.snapshots.set(snapshot.id, snapshot);
  }
  getSnapshot(id: string): KnowledgeIntelligenceSnapshot {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) throw new SnapshotNotFoundException(id);
    return snapshot;
  }
  listSnapshots(): readonly KnowledgeIntelligenceSnapshot[] {
    return [...this.snapshots.values()];
  }

  // Recommendations
  putRecommendation(recommendation: KnowledgeRecommendation): void {
    this.recommendations.set(recommendation.id, recommendation);
  }
  getRecommendation(id: string): KnowledgeRecommendation {
    const recommendation = this.recommendations.get(id);
    if (!recommendation) throw new RecommendationNotFoundException(id);
    return recommendation;
  }
  listRecommendations(): readonly KnowledgeRecommendation[] {
    return [...this.recommendations.values()];
  }

  // Insights
  putInsight(insight: KnowledgeInsight): void {
    this.insights.set(insight.id, insight);
  }
  getInsight(id: string): KnowledgeInsight {
    const insight = this.insights.get(id);
    if (!insight) throw new InsightNotFoundException(id);
    return insight;
  }
  listInsights(): readonly KnowledgeInsight[] {
    return [...this.insights.values()];
  }

  clear(): void {
    this.reports.clear();
    this.snapshots.clear();
    this.recommendations.clear();
    this.insights.clear();
  }
}
