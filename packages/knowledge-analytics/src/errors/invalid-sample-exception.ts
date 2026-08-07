import { KnowledgeAnalyticsException } from "./knowledge-analytics-exception.js";

/** Thrown when a caller-supplied metric sample or calculator input is structurally invalid. */
export class InvalidSampleException extends KnowledgeAnalyticsException {
  constructor(reason: string) {
    super(`Invalid metric sample: ${reason}`, {
      code: "INVALID_SAMPLE",
      context: { reason },
    });
  }
}
