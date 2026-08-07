import { KnowledgeMetricCalculator } from "../metrics/knowledge-metric-calculator.js";
import type { KnowledgeMetricRegistry } from "../metrics/knowledge-metric-registry.js";
import type { KnowledgeMetricTags, Clock } from "../types/common.js";
import { systemClock } from "../utils/clock.js";
import { KnowledgeMetricSample } from "../value-objects/knowledge-metric-sample.js";

/** Constructor dependencies shared by every analytics service. */
export interface BaseKnowledgeAnalyticsServiceOptions {
  readonly registry?: KnowledgeMetricRegistry;
  readonly calculator?: KnowledgeMetricCalculator;
  readonly clock?: Clock;
  /** Maximum samples retained per metric name (0 = unbounded). */
  readonly historyRetentionLimit?: number;
}

/**
 * Shared plumbing for the 11 domain-specific analytics services: per-metric sample storage,
 * an injected `KnowledgeMetricCalculator` for the actual math, an injected `KnowledgeMetricRegistry`
 * to publish current values to, and an injectable clock so tests never rely on real wall-clock time.
 */
export abstract class BaseKnowledgeAnalyticsService {
  protected readonly registry?: KnowledgeMetricRegistry;
  protected readonly calculator: KnowledgeMetricCalculator;
  protected readonly clock: Clock;
  protected readonly historyRetentionLimit: number;
  private readonly samplesByMetric = new Map<string, KnowledgeMetricSample[]>();

  protected constructor(options: BaseKnowledgeAnalyticsServiceOptions = {}) {
    this.registry = options.registry;
    this.calculator = options.calculator ?? new KnowledgeMetricCalculator();
    this.clock = options.clock ?? systemClock;
    this.historyRetentionLimit = options.historyRetentionLimit ?? 0;
  }

  /** Records one sample for `metricName` and, if a registry was supplied, refreshes its entry. */
  protected record(
    metricName: string,
    value: number,
    tags: KnowledgeMetricTags = {},
  ): KnowledgeMetricSample {
    const sample = new KnowledgeMetricSample({
      name: metricName,
      value,
      timestamp: this.clock(),
      tags,
    });
    const existing = this.samplesByMetric.get(metricName) ?? [];
    existing.push(sample);
    if (this.historyRetentionLimit > 0 && existing.length > this.historyRetentionLimit) {
      existing.splice(0, existing.length - this.historyRetentionLimit);
    }
    this.samplesByMetric.set(metricName, existing);
    return sample;
  }

  /** Returns every recorded value (not sample object) for `metricName`, oldest first. */
  protected valuesFor(metricName: string): number[] {
    return (this.samplesByMetric.get(metricName) ?? []).map((sample) => sample.value);
  }

  /** Returns every recorded sample for `metricName`, oldest first. */
  protected samplesFor(metricName: string): readonly KnowledgeMetricSample[] {
    return this.samplesByMetric.get(metricName) ?? [];
  }

  /** Publishes `value` as the metric's current value in the registry, if one was supplied. */
  protected publish(metricName: string, value: number): void {
    if (this.registry?.isRegistered(metricName)) {
      this.registry.updateValue(metricName, value, this.clock());
    }
  }

  /**
   * Groups every recorded value for `metricName` by the string tag stored at `tagKey`, summing
   * the values within each group. Samples without that tag are ignored.
   */
  protected aggregateByTag(metricName: string, tagKey: string): Readonly<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const sample of this.samplesFor(metricName)) {
      const key = sample.tags[tagKey];
      if (key === undefined) continue;
      result[key] = (result[key] ?? 0) + sample.value;
    }
    return result;
  }

  /** Total number of samples recorded across every metric this service owns. */
  sampleCount(): number {
    let total = 0;
    for (const samples of this.samplesByMetric.values()) total += samples.length;
    return total;
  }

  /** Removes every recorded sample for every metric this service owns. */
  reset(): void {
    this.samplesByMetric.clear();
  }
}
