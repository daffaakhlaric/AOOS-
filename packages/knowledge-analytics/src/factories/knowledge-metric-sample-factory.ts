import type { KnowledgeMetricTags, Clock } from "../types/common.js";
import { systemClock } from "../utils/clock.js";
import { KnowledgeMetricSample } from "../value-objects/knowledge-metric-sample.js";

/** Optional overrides accepted by {@link KnowledgeMetricSampleFactory.create}. */
export interface CreateMetricSampleOptions {
  readonly name: string;
  readonly value: number;
  readonly timestamp?: number;
  readonly tags?: KnowledgeMetricTags;
}

/** Real Factory-pattern class for constructing {@link KnowledgeMetricSample} with sensible defaults. */
export class KnowledgeMetricSampleFactory {
  private readonly clock: Clock;

  constructor(clock: Clock = systemClock) {
    this.clock = clock;
  }

  create(options: CreateMetricSampleOptions): KnowledgeMetricSample {
    return new KnowledgeMetricSample({
      name: options.name,
      value: options.value,
      timestamp: options.timestamp ?? this.clock(),
      tags: options.tags ?? {},
    });
  }
}
