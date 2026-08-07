import type { ReportType } from "../types/report-type.js";

export interface KnowledgeIntelligenceReportProps {
  readonly id: string;
  readonly type: ReportType;
  readonly title: string;
  readonly generatedAt: number;
  /**
   * Report-type-specific payload. One flexible entity is used to represent all 14 report types
   * (see README "Design Decisions") rather than 14 distinct entity classes — `sections` carries
   * whatever structured content the corresponding builder assembled for `type`.
   */
  readonly sections: Readonly<Record<string, unknown>>;
}

/** Immutable generic intelligence report aggregate, parameterized by `ReportType`. */
export class KnowledgeIntelligenceReport {
  readonly id: string;
  readonly type: ReportType;
  readonly title: string;
  readonly generatedAt: number;
  readonly sections: Readonly<Record<string, unknown>>;

  constructor(props: KnowledgeIntelligenceReportProps) {
    if (props.id.trim().length === 0) {
      throw new RangeError("KnowledgeIntelligenceReport: id must not be empty");
    }
    if (props.title.trim().length === 0) {
      throw new RangeError("KnowledgeIntelligenceReport: title must not be empty");
    }
    this.id = props.id;
    this.type = props.type;
    this.title = props.title;
    this.generatedAt = props.generatedAt;
    this.sections = props.sections;
    Object.freeze(this);
    Object.freeze(this.sections);
  }
}
