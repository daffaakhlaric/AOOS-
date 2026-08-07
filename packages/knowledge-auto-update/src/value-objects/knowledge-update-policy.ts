import type { ConflictResolutionStrategyName } from "../types/conflict-resolution-strategy.js";

/** Retry count/delay/backoff rules. */
export interface RetryPolicyRules {
  readonly maxRetries: number;
  readonly retryDelayMs: number;
  readonly backoffMultiplier: number;
  readonly maxBackoffDelayMs: number;
}

/** Which conflict-resolution strategy to apply when two updates collide. */
export interface ConflictResolutionRules {
  readonly strategy: ConflictResolutionStrategyName;
}

/** Weights combined by `KnowledgePriorityCalculator` into a single numeric priority score. */
export interface PriorityRules {
  readonly baseWeight: number;
  readonly stalenessWeight: number;
  readonly dependencyWeight: number;
}

/** Whether job dependency ordering is enforced, and how deep a dependency chain may go. */
export interface DependencyRules {
  readonly enforceOrder: boolean;
  readonly maxChainDepth: number;
}

/** How old (ms since last update) a knowledge asset may get before it is considered stale. */
export interface FreshnessRules {
  readonly maxAgeMs: number;
}

/** How old a pending job may get before it is treated as expired rather than run. */
export interface ExpirationRules {
  readonly expireAfterMs: number;
}

/** Minimum/maximum asset versions this policy permits updating between. */
export interface VersionCompatibilityRules {
  readonly minVersion: string;
  readonly maxVersion: string;
}

/** Hour-of-day (UTC, 0-23) window during which updates are permitted to run. Logical only. */
export interface UpdateWindowRules {
  readonly startHourUtc: number;
  readonly endHourUtc: number;
}

/** Maximum number of updates permitted per sliding time window. Logical only (no OS timers). */
export interface RateLimitingRules {
  readonly maxUpdatesPerWindow: number;
  readonly windowMs: number;
}

export interface KnowledgeUpdatePolicyProps {
  readonly id: string;
  readonly name: string;
  readonly retry: RetryPolicyRules;
  readonly conflictResolution: ConflictResolutionRules;
  readonly priority: PriorityRules;
  readonly dependency: DependencyRules;
  readonly freshness: FreshnessRules;
  readonly expiration: ExpirationRules;
  readonly versionCompatibility: VersionCompatibilityRules;
  readonly updateWindow: UpdateWindowRules;
  readonly rateLimiting: RateLimitingRules;
}

/**
 * Immutable composite value object covering all 11 policy categories from the spec (Maximum
 * Retry + Retry Delay + Exponential Backoff are modeled together as `RetryPolicyRules`; the
 * remaining 8 categories each get their own small rules interface). Composed rather than
 * flattened so each category can be validated, tested, and reused independently.
 */
export class KnowledgeUpdatePolicy {
  readonly id: string;
  readonly name: string;
  readonly retry: RetryPolicyRules;
  readonly conflictResolution: ConflictResolutionRules;
  readonly priority: PriorityRules;
  readonly dependency: DependencyRules;
  readonly freshness: FreshnessRules;
  readonly expiration: ExpirationRules;
  readonly versionCompatibility: VersionCompatibilityRules;
  readonly updateWindow: UpdateWindowRules;
  readonly rateLimiting: RateLimitingRules;

  constructor(props: KnowledgeUpdatePolicyProps) {
    if (props.name.trim().length === 0) {
      throw new RangeError("KnowledgeUpdatePolicy: name must not be empty");
    }
    if (props.retry.maxRetries < 0) {
      throw new RangeError("KnowledgeUpdatePolicy: retry.maxRetries must be >= 0");
    }
    if (props.retry.retryDelayMs < 0) {
      throw new RangeError("KnowledgeUpdatePolicy: retry.retryDelayMs must be >= 0");
    }
    if (props.retry.backoffMultiplier < 1) {
      throw new RangeError("KnowledgeUpdatePolicy: retry.backoffMultiplier must be >= 1");
    }
    if (props.updateWindow.startHourUtc < 0 || props.updateWindow.startHourUtc > 23) {
      throw new RangeError("KnowledgeUpdatePolicy: updateWindow.startHourUtc must be 0-23");
    }
    if (props.updateWindow.endHourUtc < 0 || props.updateWindow.endHourUtc > 23) {
      throw new RangeError("KnowledgeUpdatePolicy: updateWindow.endHourUtc must be 0-23");
    }
    if (props.rateLimiting.maxUpdatesPerWindow < 0) {
      throw new RangeError("KnowledgeUpdatePolicy: rateLimiting.maxUpdatesPerWindow must be >= 0");
    }

    this.id = props.id;
    this.name = props.name;
    this.retry = props.retry;
    this.conflictResolution = props.conflictResolution;
    this.priority = props.priority;
    this.dependency = props.dependency;
    this.freshness = props.freshness;
    this.expiration = props.expiration;
    this.versionCompatibility = props.versionCompatibility;
    this.updateWindow = props.updateWindow;
    this.rateLimiting = props.rateLimiting;
    Object.freeze(this);
  }

  /**
   * Whether `hourUtc` (0-23) falls inside the configured update window. Wraps across midnight
   * when `startHourUtc > endHourUtc` (e.g. 22 -> 4 means 22:00-23:59 and 00:00-03:59).
   */
  isWithinUpdateWindow(hourUtc: number): boolean {
    const { startHourUtc, endHourUtc } = this.updateWindow;
    if (startHourUtc === endHourUtc) return true;
    if (startHourUtc < endHourUtc) {
      return hourUtc >= startHourUtc && hourUtc < endHourUtc;
    }
    return hourUtc >= startHourUtc || hourUtc < endHourUtc;
  }

  withRetry(retry: Partial<RetryPolicyRules>): KnowledgeUpdatePolicy {
    return new KnowledgeUpdatePolicy({ ...this, retry: { ...this.retry, ...retry } });
  }
}
