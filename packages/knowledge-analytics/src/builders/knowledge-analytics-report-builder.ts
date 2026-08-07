import { InvalidReportTypeException } from "../errors/invalid-report-type-exception.js";
import { KnowledgeAnalyticsReport } from "../reports/knowledge-analytics-report.js";
import { KnowledgeReportType } from "../types/report-type.js";
import { generateId } from "../utils/id-generator.js";

/** The section key each non-composite report type requires to have been supplied before `build()`. */
const REQUIRED_SECTION_BY_TYPE: Readonly<Partial<Record<KnowledgeReportType, string>>> = {
  [KnowledgeReportType.Usage]: "usage",
  [KnowledgeReportType.Performance]: "performance",
  [KnowledgeReportType.Graph]: "graph",
  [KnowledgeReportType.Quality]: "quality",
  [KnowledgeReportType.Embedding]: "embedding",
  [KnowledgeReportType.Trend]: "trend",
  [KnowledgeReportType.Cost]: "cost",
  [KnowledgeReportType.Recommendation]: "recommendation",
};

/** Options accepted by {@link KnowledgeAnalyticsReportBuilder.build}. */
export interface BuildReportOptions {
  readonly id?: string;
  readonly generatedAt: number;
}

/**
 * Real Builder-pattern class assembling one of the 10 `KnowledgeReportType`s from the analytics
 * services' current state. Callers feed section content via the `.withX(...)` methods (each
 * accepting whatever shape the corresponding analytics service produces), then call `.build(type, ...)`.
 *
 * - Single-domain types (Usage, Performance, Graph, Quality, Embedding, Trend, Cost, Recommendation)
 *   require their one matching section to have been supplied and include only that section.
 * - `Summary` and `DashboardSnapshot` are composite: they include every section supplied so far,
 *   with no single section required (an empty summary is valid — it just has no sections).
 *
 * The builder is stateful and reusable: `.build()` does not clear state, but `.reset()` does.
 */
export class KnowledgeAnalyticsReportBuilder {
  private sections: Record<string, unknown> = {};

  withUsage(section: unknown): this {
    this.sections.usage = section;
    return this;
  }

  withSearch(section: unknown): this {
    this.sections.search = section;
    return this;
  }

  withRetrieval(section: unknown): this {
    this.sections.retrieval = section;
    return this;
  }

  withQuery(section: unknown): this {
    this.sections.query = section;
    return this;
  }

  withEmbedding(section: unknown): this {
    this.sections.embedding = section;
    return this;
  }

  withGraph(section: unknown): this {
    this.sections.graph = section;
    return this;
  }

  withQuality(section: unknown): this {
    this.sections.quality = section;
    return this;
  }

  withPerformance(section: unknown): this {
    this.sections.performance = section;
    return this;
  }

  withTrend(section: unknown): this {
    this.sections.trend = section;
    return this;
  }

  withCost(section: unknown): this {
    this.sections.cost = section;
    return this;
  }

  withRecommendation(section: unknown): this {
    this.sections.recommendation = section;
    return this;
  }

  reset(): this {
    this.sections = {};
    return this;
  }

  build(type: KnowledgeReportType, options: BuildReportOptions): KnowledgeAnalyticsReport {
    if (!Object.values(KnowledgeReportType).includes(type)) {
      throw new InvalidReportTypeException(String(type));
    }

    const requiredKey = REQUIRED_SECTION_BY_TYPE[type];
    let sections: Record<string, unknown>;
    if (requiredKey === undefined) {
      // Composite type (Summary / DashboardSnapshot): include everything supplied so far.
      sections = { ...this.sections };
    } else {
      if (!(requiredKey in this.sections)) {
        throw new InvalidReportTypeException(
          type,
          `the "${requiredKey}" section must be supplied via .with${requiredKey[0]!.toUpperCase()}${requiredKey.slice(1)}() before build()`,
        );
      }
      sections = { [requiredKey]: this.sections[requiredKey] };
    }

    return new KnowledgeAnalyticsReport({
      id: options.id ?? generateId("report"),
      type,
      generatedAt: options.generatedAt,
      sections,
    });
  }
}
