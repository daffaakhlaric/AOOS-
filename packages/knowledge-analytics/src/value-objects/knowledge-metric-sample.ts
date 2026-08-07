import { InvalidSampleException } from "../errors/invalid-sample-exception.js";
import type { KnowledgeMetricTags } from "../types/common.js";

/** Constructor properties for {@link KnowledgeMetricSample}. */
export interface KnowledgeMetricSampleProps {
  readonly name: string;
  readonly value: number;
  readonly timestamp: number;
  readonly tags?: KnowledgeMetricTags;
}

/**
 * Immutable value object: one raw data point recorded by a caller (e.g. one search's latency, one
 * cache lookup's hit/miss outcome as 1/0). Analytics services aggregate many of these to derive
 * rates, averages, and percentiles — the sample itself never changes once created.
 */
export class KnowledgeMetricSample {
  public readonly name: string;
  public readonly value: number;
  public readonly timestamp: number;
  public readonly tags: KnowledgeMetricTags;

  constructor(props: KnowledgeMetricSampleProps) {
    if (props.name.trim().length === 0) {
      throw new InvalidSampleException("sample name must be a non-empty string");
    }
    if (!Number.isFinite(props.value)) {
      throw new InvalidSampleException(
        `sample value must be a finite number, received ${props.value}`,
      );
    }
    if (!Number.isFinite(props.timestamp) || props.timestamp < 0) {
      throw new InvalidSampleException(
        `sample timestamp must be a non-negative finite number, received ${props.timestamp}`,
      );
    }
    this.name = props.name;
    this.value = props.value;
    this.timestamp = props.timestamp;
    this.tags = Object.freeze({ ...(props.tags ?? {}) });
    Object.freeze(this);
  }

  /** Returns a new sample with `tags` merged over the existing tags (immutable update). */
  withTags(tags: KnowledgeMetricTags): KnowledgeMetricSample {
    return new KnowledgeMetricSample({
      name: this.name,
      value: this.value,
      timestamp: this.timestamp,
      tags: { ...this.tags, ...tags },
    });
  }
}
