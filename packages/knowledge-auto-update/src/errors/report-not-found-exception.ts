import { KnowledgeAutoUpdateException } from "./knowledge-auto-update-exception.js";

export class ReportNotFoundException extends KnowledgeAutoUpdateException {
  constructor(reportId: string) {
    super(`Knowledge update report not found: ${reportId}`, {
      code: "REPORT_NOT_FOUND",
      context: { reportId },
    });
  }
}
