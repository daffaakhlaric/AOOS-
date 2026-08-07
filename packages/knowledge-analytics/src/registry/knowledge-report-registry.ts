import { ReportNotFoundException } from "../errors/report-not-found-exception.js";
import type { KnowledgeAnalyticsReport } from "../reports/knowledge-analytics-report.js";

/** Id-keyed registry of previously generated reports. Lookups are `Map.get` — no scanning. */
export class KnowledgeReportRegistry {
  private readonly reports = new Map<string, KnowledgeAnalyticsReport>();

  add(report: KnowledgeAnalyticsReport): void {
    this.reports.set(report.id, report);
  }

  get(id: string): KnowledgeAnalyticsReport {
    const report = this.reports.get(id);
    if (!report) throw new ReportNotFoundException(id);
    return report;
  }

  tryGet(id: string): KnowledgeAnalyticsReport | undefined {
    return this.reports.get(id);
  }

  has(id: string): boolean {
    return this.reports.has(id);
  }

  list(): readonly KnowledgeAnalyticsReport[] {
    return [...this.reports.values()];
  }

  remove(id: string): boolean {
    return this.reports.delete(id);
  }

  size(): number {
    return this.reports.size;
  }

  clear(): void {
    this.reports.clear();
  }
}
