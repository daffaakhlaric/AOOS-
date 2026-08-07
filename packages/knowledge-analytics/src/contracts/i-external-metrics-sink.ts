import type { KnowledgeMetricSample } from "../value-objects/knowledge-metric-sample.js";

/**
 * Optional, pluggable extension point: a host MAY supply an implementation of this interface to
 * `KnowledgeAnalyticsEngine` to mirror every recorded sample somewhere else (a log, a real metrics
 * backend adapter, etc). It is never required — `KnowledgeAnalyticsEngine` works entirely without
 * one, since this package never reaches out to any external system on its own.
 */
export interface IExternalMetricsSink {
  receive(sample: KnowledgeMetricSample): void;
}
