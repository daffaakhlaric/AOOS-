import type { Option } from "@aos/common";

import type { Objective } from "../domain/entities/Objective.js";
import type { ObjectiveProgress } from "../domain/entities/ObjectiveProgress.js";
import type { SamanthaRecommendation } from "../domain/entities/SamanthaRecommendation.js";
import type { ObjectiveId } from "../domain/value-objects/ObjectiveId.js";
import type { ObjectivePeriod } from "../domain/value-objects/ObjectivePeriod.js";

/**
 * Repository Pattern port over this package's in-memory Objective store (spec:
 * `IObjectiveRepository.ts ← in-memory only`) — no DB, no filesystem, per Hard Constraints.
 * Also holds each Objective's latest `ObjectiveProgress`/`SamanthaRecommendation` snapshot, since
 * this package tracks only the most recent state of each (no history/versioning requirement in
 * the spec), mirroring `@aos/meta-ads-connector`'s `AdAccountRegistry` "latest snapshot" pattern.
 */
export interface IObjectiveRepository {
  findById(id: ObjectiveId): Option<Objective>;
  /** Finds an `ACTIVE` or `DRAFT` Objective for the given tenant/period — used by `CreateObjective`'s "max 1 active objective per tenant per month" rule. */
  findActiveByTenantAndPeriod(tenantId: string, period: ObjectivePeriod): Option<Objective>;
  save(objective: Objective): void;

  findLatestProgress(objectiveId: ObjectiveId): Option<ObjectiveProgress>;
  saveProgress(progress: ObjectiveProgress): void;

  findLatestRecommendation(objectiveId: ObjectiveId): Option<SamanthaRecommendation>;
  saveRecommendation(recommendation: SamanthaRecommendation): void;

  /** Every stored Objective for a tenant, regardless of status — used by `CreateObjective`'s "max N active objectives per tenant per month" count (N may exceed 1) and by `ObjectiveRegistry` listing. */
  listByTenant(tenantId: string): ReadonlyArray<Objective>;
}
