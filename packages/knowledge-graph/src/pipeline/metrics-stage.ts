import type { GraphOperationDescriptor } from "./graph-operation-descriptor.js";

/** Stage 6 — Metrics. Records counters/gauges for the operation's outcome, when the descriptor supplies a recorder. */
export function runMetricsStage<T>(descriptor: GraphOperationDescriptor<T>, output: T): void {
  descriptor.recordMetrics?.(output);
}
