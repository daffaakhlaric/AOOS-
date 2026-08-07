import type { GraphOperationDescriptor } from "../pipeline/graph-operation-descriptor.js";
import { highResolutionNow } from "../utils/index.js";

import type { PipelineMiddleware } from "./pipeline-middleware.js";

/**
 * Measures the wall-clock duration of each pipeline execution (all 7 stages, including a failing
 * one — the `finally` records the sample either way) and keeps the samples grouped by operation
 * type, so `KnowledgeGraphMonitor`'s Performance dimension can report per-operation averages.
 */
export class TimingMiddleware implements PipelineMiddleware {
  private readonly samplesByOperation = new Map<string, number[]>();

  around<T>(descriptor: GraphOperationDescriptor<T>, next: () => T): T {
    const started = highResolutionNow();
    try {
      return next();
    } finally {
      const durationMs = highResolutionNow() - started;
      const samples = this.samplesByOperation.get(descriptor.operation) ?? [];
      samples.push(durationMs);
      this.samplesByOperation.set(descriptor.operation, samples);
    }
  }

  averageDurationMs(operation: string): number {
    const samples = this.samplesByOperation.get(operation) ?? [];
    if (samples.length === 0) return 0;
    return samples.reduce((sum, value) => sum + value, 0) / samples.length;
  }

  sampleCount(operation: string): number {
    return this.samplesByOperation.get(operation)?.length ?? 0;
  }

  clear(): void {
    this.samplesByOperation.clear();
  }
}
