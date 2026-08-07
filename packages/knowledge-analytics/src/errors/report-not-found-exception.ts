import { KnowledgeAnalyticsException } from "./knowledge-analytics-exception.js";

/** Thrown when a report id is looked up in the report registry but does not exist. */
export class ReportNotFoundException extends KnowledgeAnalyticsException {
  constructor(reportId: string) {
    super(`Report "${reportId}" was not found in the report registry`, {
      code: "REPORT_NOT_FOUND",
      context: { reportId },
    });
  }
}
