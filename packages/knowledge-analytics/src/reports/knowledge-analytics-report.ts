import type { KnowledgeReportType } from "../types/report-type.js";

/** Constructor properties for {@link KnowledgeAnalyticsReport}. */
export interface KnowledgeAnalyticsReportProps {
  readonly id: string;
  readonly type: KnowledgeReportType;
  readonly generatedAt: number;
  readonly sections: Readonly<Record<string, unknown>>;
}

/**
 * Immutable entity: one generated analytics report. `sections` holds the type-specific content
 * assembled by `KnowledgeAnalyticsReportBuilder` — its shape differs per `type` (see the builder
 * for exactly what each of the 10 report types populates).
 */
export class KnowledgeAnalyticsReport {
  public readonly id: string;
  public readonly type: KnowledgeReportType;
  public readonly generatedAt: number;
  public readonly sections: Readonly<Record<string, unknown>>;

  constructor(props: KnowledgeAnalyticsReportProps) {
    this.id = props.id;
    this.type = props.type;
    this.generatedAt = props.generatedAt;
    this.sections = Object.freeze({ ...props.sections });
    Object.freeze(this);
  }
}
