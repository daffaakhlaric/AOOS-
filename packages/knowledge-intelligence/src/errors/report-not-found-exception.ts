import { KnowledgeIntelligenceException } from "./knowledge-intelligence-exception.js";

export class ReportNotFoundException extends KnowledgeIntelligenceException {
  constructor(reportId: string) {
    super(`Knowledge intelligence report not found: ${reportId}`, {
      code: "REPORT_NOT_FOUND",
      context: { reportId },
    });
  }
}
