import { KnowledgeAnalyticsException } from "./knowledge-analytics-exception.js";

/** Thrown when a metric id/name is looked up in the registry but has never been registered. */
export class MetricNotFoundException extends KnowledgeAnalyticsException {
  constructor(metricId: string) {
    super(`Metric "${metricId}" was not found in the metric registry`, {
      code: "METRIC_NOT_FOUND",
      context: { metricId },
    });
  }
}
