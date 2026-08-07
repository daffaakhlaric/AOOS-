import type { HealthStatus } from "../types/health-status.js";

export interface KnowledgeHealthScoreProps {
  readonly overall: number;
  readonly quality: number;
  readonly freshness: number;
  readonly coverage: number;
  readonly risk: number;
  readonly status: HealthStatus;
}

/** Immutable composite health score with its four contributing sub-scores. */
export class KnowledgeHealthScore {
  readonly overall: number;
  readonly quality: number;
  readonly freshness: number;
  readonly coverage: number;
  readonly risk: number;
  readonly status: HealthStatus;

  constructor(props: KnowledgeHealthScoreProps) {
    for (const [key, value] of Object.entries({
      overall: props.overall,
      quality: props.quality,
      freshness: props.freshness,
      coverage: props.coverage,
      risk: props.risk,
    })) {
      if (value < 0 || value > 100) {
        throw new RangeError(`KnowledgeHealthScore: ${key} must be within [0, 100]`);
      }
    }
    this.overall = props.overall;
    this.quality = props.quality;
    this.freshness = props.freshness;
    this.coverage = props.coverage;
    this.risk = props.risk;
    this.status = props.status;
    Object.freeze(this);
  }
}
