import { ConflictResolutionStrategyName } from "../types/conflict-resolution-strategy.js";
import { generateId } from "../utils/id-generator.js";
import { KnowledgeUpdatePolicy } from "../value-objects/knowledge-update-policy.js";

export interface CreatePolicyInput {
  readonly name: string;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
  readonly backoffMultiplier?: number;
  readonly maxBackoffDelayMs?: number;
  readonly conflictResolutionStrategy?: ConflictResolutionStrategyName;
  readonly maxAgeMs?: number;
  readonly expireAfterMs?: number;
}

/** Real Factory-pattern class building `KnowledgeUpdatePolicy` instances with sane defaults. */
export class KnowledgeUpdatePolicyFactory {
  create(input: CreatePolicyInput): KnowledgeUpdatePolicy {
    return new KnowledgeUpdatePolicy({
      id: generateId("policy"),
      name: input.name,
      retry: {
        maxRetries: input.maxRetries ?? 3,
        retryDelayMs: input.retryDelayMs ?? 1_000,
        backoffMultiplier: input.backoffMultiplier ?? 2,
        maxBackoffDelayMs: input.maxBackoffDelayMs ?? 60_000,
      },
      conflictResolution: {
        strategy: input.conflictResolutionStrategy ?? ConflictResolutionStrategyName.LastWriteWins,
      },
      priority: { baseWeight: 1, stalenessWeight: 1, dependencyWeight: 1 },
      dependency: { enforceOrder: true, maxChainDepth: 50 },
      freshness: { maxAgeMs: input.maxAgeMs ?? 86_400_000 },
      expiration: { expireAfterMs: input.expireAfterMs ?? 604_800_000 },
      versionCompatibility: { minVersion: "0.0.0", maxVersion: "999.999.999" },
      updateWindow: { startHourUtc: 0, endHourUtc: 0 },
      rateLimiting: { maxUpdatesPerWindow: 1000, windowMs: 60_000 },
    });
  }

  static defaultPolicy(): KnowledgeUpdatePolicy {
    return new KnowledgeUpdatePolicyFactory().create({ name: "default" });
  }
}
