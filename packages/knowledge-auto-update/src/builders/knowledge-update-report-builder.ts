import { KnowledgeUpdateReport } from "../entities/knowledge-update-report.js";
import type { KnowledgeUpdateReportType } from "../types/report-type.js";
import { generateId } from "../utils/id-generator.js";

/**
 * Real fluent Builder-pattern class assembling one of the 10 `KnowledgeUpdateReportType`s from
 * whatever (Manager/Scheduler/Statistics/Metrics-derived) plain data the caller accumulates via
 * `withField`.
 */
export class KnowledgeUpdateReportBuilder {
  private type: KnowledgeUpdateReportType | undefined;
  private data: Record<string, unknown> = {};

  ofType(type: KnowledgeUpdateReportType): this {
    this.type = type;
    return this;
  }

  withField(key: string, value: unknown): this {
    this.data[key] = value;
    return this;
  }

  withData(data: Readonly<Record<string, unknown>>): this {
    this.data = { ...this.data, ...data };
    return this;
  }

  build(now: number): KnowledgeUpdateReport {
    if (!this.type) {
      throw new RangeError("KnowledgeUpdateReportBuilder: report type must be set before build()");
    }
    return new KnowledgeUpdateReport({
      id: generateId("report"),
      type: this.type,
      generatedAt: now,
      data: { ...this.data },
    });
  }
}
