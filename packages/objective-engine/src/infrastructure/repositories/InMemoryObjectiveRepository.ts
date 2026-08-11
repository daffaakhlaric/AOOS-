import { none, some, type Option } from "@aos/common";

import type { IObjectiveRepository } from "../../contracts/IObjectiveRepository.js";
import type { Objective } from "../../domain/entities/Objective.js";
import type { ObjectiveProgress } from "../../domain/entities/ObjectiveProgress.js";
import type { TamaraRecommendation } from "../../domain/entities/TamaraRecommendation.js";
import type { ObjectiveId } from "../../domain/value-objects/ObjectiveId.js";
import type { ObjectivePeriod } from "../../domain/value-objects/ObjectivePeriod.js";
import { ObjectiveStatus } from "../../domain/value-objects/ObjectiveStatus.js";

/**
 * In-memory, per-process implementation of `IObjectiveRepository` (spec:
 * `IObjectiveRepository.ts ← in-memory only`) — no DB, no filesystem writes, per Hard
 * Constraints. Holds the latest snapshot of each Objective's progress/recommendation, mirroring
 * `@aos/meta-ads-connector`'s `AdAccountRegistry` "latest snapshot, not full history" convention.
 */
export class InMemoryObjectiveRepository implements IObjectiveRepository {
  private readonly objectivesById = new Map<string, Objective>();
  private readonly progressByObjectiveId = new Map<string, ObjectiveProgress>();
  private readonly recommendationByObjectiveId = new Map<string, TamaraRecommendation>();

  findById(id: ObjectiveId): Option<Objective> {
    const found = this.objectivesById.get(id.toString());
    return found === undefined ? none : some(found);
  }

  findActiveByTenantAndPeriod(tenantId: string, period: ObjectivePeriod): Option<Objective> {
    for (const objective of this.objectivesById.values()) {
      if (
        objective.tenantId === tenantId &&
        objective.period.equals(period) &&
        (objective.status === ObjectiveStatus.ACTIVE || objective.status === ObjectiveStatus.DRAFT)
      ) {
        return some(objective);
      }
    }
    return none;
  }

  save(objective: Objective): void {
    this.objectivesById.set(objective.id.toString(), objective);
  }

  findLatestProgress(objectiveId: ObjectiveId): Option<ObjectiveProgress> {
    const found = this.progressByObjectiveId.get(objectiveId.toString());
    return found === undefined ? none : some(found);
  }

  saveProgress(progress: ObjectiveProgress): void {
    this.progressByObjectiveId.set(progress.objectiveId.toString(), progress);
  }

  findLatestRecommendation(objectiveId: ObjectiveId): Option<TamaraRecommendation> {
    const found = this.recommendationByObjectiveId.get(objectiveId.toString());
    return found === undefined ? none : some(found);
  }

  saveRecommendation(recommendation: TamaraRecommendation): void {
    this.recommendationByObjectiveId.set(recommendation.objectiveId.toString(), recommendation);
  }

  /** Every stored Objective for a tenant, regardless of status — for `ObjectiveRegistry` listing. */
  listByTenant(tenantId: string): ReadonlyArray<Objective> {
    return [...this.objectivesById.values()].filter((o) => o.tenantId === tenantId);
  }

  /** Removes every stored Objective/progress/recommendation — primarily for test isolation. */
  clear(): void {
    this.objectivesById.clear();
    this.progressByObjectiveId.clear();
    this.recommendationByObjectiveId.clear();
  }
}
