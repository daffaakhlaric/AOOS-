import { ConflictUnresolvedException } from "../errors/conflict-unresolved-exception.js";
import type { Metadata } from "../types/common.js";
import { ConflictResolutionStrategyName } from "../types/conflict-resolution-strategy.js";

import { KnowledgeVersionComparator } from "./knowledge-version-comparator.js";

export interface ConflictCandidate {
  readonly source: string;
  readonly payload: Metadata;
  readonly updatedAt: number;
  readonly version?: string;
}

export interface ConflictResolution {
  readonly winner: ConflictCandidate;
  readonly strategy: ConflictResolutionStrategyName;
  readonly reason: string;
}

/**
 * Real conflict-resolution service implementing 2 strategies via the Strategy pattern:
 *  - `LastWriteWins`: the candidate with the latest `updatedAt` wins (ties keep the first).
 *  - `VersionPriority`: the candidate with the highest semantic version wins; every candidate
 *    must supply a `version`, otherwise `ConflictUnresolvedException` is thrown.
 */
export class KnowledgeConflictResolver {
  private readonly versionComparator: KnowledgeVersionComparator;

  constructor(versionComparator: KnowledgeVersionComparator = new KnowledgeVersionComparator()) {
    this.versionComparator = versionComparator;
  }

  resolve(
    jobId: string,
    candidates: readonly ConflictCandidate[],
    strategy: ConflictResolutionStrategyName,
  ): ConflictResolution {
    if (candidates.length === 0) {
      throw new ConflictUnresolvedException(jobId, "no candidates supplied");
    }
    if (candidates.length === 1) {
      return { winner: candidates[0]!, strategy, reason: "single_candidate" };
    }

    if (strategy === ConflictResolutionStrategyName.LastWriteWins) {
      return this.resolveLastWriteWins(candidates, strategy);
    }
    return this.resolveVersionPriority(jobId, candidates, strategy);
  }

  private resolveLastWriteWins(
    candidates: readonly ConflictCandidate[],
    strategy: ConflictResolutionStrategyName,
  ): ConflictResolution {
    let winner = candidates[0]!;
    for (const candidate of candidates.slice(1)) {
      if (candidate.updatedAt > winner.updatedAt) winner = candidate;
    }
    return { winner, strategy, reason: "latest_updated_at" };
  }

  private resolveVersionPriority(
    jobId: string,
    candidates: readonly ConflictCandidate[],
    strategy: ConflictResolutionStrategyName,
  ): ConflictResolution {
    if (candidates.some((c) => c.version === undefined)) {
      throw new ConflictUnresolvedException(
        jobId,
        "version_priority strategy requires every candidate to supply a version",
      );
    }
    let winner = candidates[0]!;
    for (const candidate of candidates.slice(1)) {
      if (this.versionComparator.isNewer(candidate.version!, winner.version!)) {
        winner = candidate;
      }
    }
    return { winner, strategy, reason: "highest_version" };
  }
}
