import { KnowledgeAnalyticsException } from "./knowledge-analytics-exception.js";

/**
 * Thrown when: (a) a report is requested for a report type the builder does not recognize, or
 * (b) a recognized single-domain report type is built before its required section was supplied.
 */
export class InvalidReportTypeException extends KnowledgeAnalyticsException {
  constructor(reportType: string, reason?: string) {
    super(
      reason
        ? `"${reportType}" report cannot be built: ${reason}`
        : `"${reportType}" is not a supported knowledge analytics report type`,
      {
        code: "INVALID_REPORT_TYPE",
        context: { reportType, reason },
      },
    );
  }
}
