import type { Option } from "@aos/common";

import type { Objective } from "../domain/entities/Objective.js";
import type { ObjectiveProgress } from "../domain/entities/ObjectiveProgress.js";
import type { TamaraRecommendation } from "../domain/entities/TamaraRecommendation.js";
import type { ObjectiveId } from "../domain/value-objects/ObjectiveId.js";
import type { InMemoryObjectiveRepository } from "../infrastructure/repositories/InMemoryObjectiveRepository.js";

/**
 * The public, read-oriented query surface over the package's in-memory Objective store — part of
 * the spec's Public API (`export { ObjectiveRegistry } from "./registry/ObjectiveRegistry.js"`).
 * Distinct from `IObjectiveRepository`/`InMemoryObjectiveRepository`: the repository is the
 * write-capable port the seven use cases depend on internally; `ObjectiveRegistry` is a thin,
 * external-consumer-facing wrapper (e.g. for a future `apps/aaos-api` dashboard endpoint) that
 * only ever reads — it cannot save/mutate anything, by construction (no `save*` methods),
 * mirroring `@aos/meta-ads-connector`'s `AdAccountRegistry` being the public lookup surface over
 * its own in-memory store.
 */
export class ObjectiveRegistry {
  constructor(private readonly repository: InMemoryObjectiveRepository) {}

  get(id: ObjectiveId): Option<Objective> {
    return this.repository.findById(id);
  }

  listByTenant(tenantId: string): ReadonlyArray<Objective> {
    return this.repository.listByTenant(tenantId);
  }

  getProgress(id: ObjectiveId): Option<ObjectiveProgress> {
    return this.repository.findLatestProgress(id);
  }

  getRecommendation(id: ObjectiveId): Option<TamaraRecommendation> {
    return this.repository.findLatestRecommendation(id);
  }
}
