import type { IClock } from "../contracts/i-clock.js";
import { KnowledgeIntelligenceReport } from "../entities/knowledge-intelligence-report.js";
import { ReportType } from "../types/report-type.js";
import { generateId } from "../utils/id-generator.js";

export interface BuildReportInput {
  readonly type: ReportType;
  readonly title: string;
  readonly sections: Readonly<Record<string, unknown>>;
}

/**
 * Builder-pattern report builder. One flexible entity (`KnowledgeIntelligenceReport`) is used to
 * represent all 14 report types from the spec's "Reports" section — see README "Design
 * Decisions" — this builder is the single place that stamps a fresh id/timestamp and assembles
 * the `sections` payload for whichever `ReportType` the caller requests.
 */
export class KnowledgeIntelligenceReportBuilder {
  constructor(private readonly clock: IClock) {}

  build(input: BuildReportInput): KnowledgeIntelligenceReport {
    return new KnowledgeIntelligenceReport({
      id: generateId("report"),
      type: input.type,
      title: input.title,
      generatedAt: this.clock.now(),
      sections: input.sections,
    });
  }

  buildExecutiveSummary(sections: Readonly<Record<string, unknown>>): KnowledgeIntelligenceReport {
    return this.build({ type: ReportType.ExecutiveSummary, title: "Executive Summary", sections });
  }
}
