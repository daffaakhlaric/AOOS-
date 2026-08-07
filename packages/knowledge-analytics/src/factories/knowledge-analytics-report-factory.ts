import { KnowledgeAnalyticsReport } from "../reports/knowledge-analytics-report.js";
import type { Clock } from "../types/common.js";
import { KnowledgeReportType } from "../types/report-type.js";
import { systemClock } from "../utils/clock.js";
import { generateId } from "../utils/id-generator.js";

/** Optional overrides accepted by {@link KnowledgeAnalyticsReportFactory.create}. */
export interface CreateAnalyticsReportOptions {
  readonly id?: string;
  readonly type?: KnowledgeReportType;
  readonly generatedAt?: number;
  readonly sections?: Readonly<Record<string, unknown>>;
}

/**
 * Real Factory-pattern class for constructing {@link KnowledgeAnalyticsReport} directly (with
 * sensible defaults: `Summary` type, empty sections, current time). Prefer
 * `KnowledgeAnalyticsReportBuilder` when assembling a report from live analytics-service state —
 * this factory exists for the simpler case of wrapping already-computed section content.
 */
export class KnowledgeAnalyticsReportFactory {
  private readonly clock: Clock;

  constructor(clock: Clock = systemClock) {
    this.clock = clock;
  }

  create(options: CreateAnalyticsReportOptions = {}): KnowledgeAnalyticsReport {
    return new KnowledgeAnalyticsReport({
      id: options.id ?? generateId("report"),
      type: options.type ?? KnowledgeReportType.Summary,
      generatedAt: options.generatedAt ?? this.clock(),
      sections: options.sections ?? {},
    });
  }
}
