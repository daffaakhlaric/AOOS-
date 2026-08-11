import type { Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import { Objective, type ObjectiveProps } from "../domain/entities/Objective.js";
import { AreaPriority } from "../domain/value-objects/AreaPriority.js";
import { BudgetAllocation } from "../domain/value-objects/BudgetAllocation.js";
import { FocusUnit } from "../domain/value-objects/FocusUnit.js";
import { ObjectiveId } from "../domain/value-objects/ObjectiveId.js";
import { ObjectivePeriod } from "../domain/value-objects/ObjectivePeriod.js";
import { ObjectiveStatus } from "../domain/value-objects/ObjectiveStatus.js";
import { TargetLeads } from "../domain/value-objects/TargetLeads.js";

/**
 * Builder Pattern class for constructing `Objective` entities with sensible defaults — used both
 * by production composition and by this package's own tests, mirroring
 * `@aos/meta-ads-connector`'s `CampaignBuilder` convention.
 */
export class ObjectiveBuilder {
  private props: ObjectiveProps = {
    id: ObjectiveId.generate(),
    tenantId: "dss-motor",
    period: unwrapOrThrow(ObjectivePeriod.create({ month: 8, year: 2026 })),
    targetHotLeads: unwrapOrThrow(TargetLeads.create(50)),
    budgetAllocation: unwrapOrThrow(BudgetAllocation.create(30_000_000)),
    focusUnits: [
      unwrapOrThrow(FocusUnit.create("Xpander")),
      unwrapOrThrow(FocusUnit.create("Brio")),
    ],
    areaPriorities: [unwrapOrThrow(AreaPriority.create("CINERE"))],
    status: ObjectiveStatus.DRAFT,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
  };

  withId(id: ObjectiveId): this {
    this.props = { ...this.props, id };
    return this;
  }

  withTenantId(tenantId: string): this {
    this.props = { ...this.props, tenantId };
    return this;
  }

  withPeriod(period: ObjectivePeriod): this {
    this.props = { ...this.props, period };
    return this;
  }

  withTargetHotLeads(targetHotLeads: TargetLeads): this {
    this.props = { ...this.props, targetHotLeads };
    return this;
  }

  withBudgetAllocation(budgetAllocation: BudgetAllocation): this {
    this.props = { ...this.props, budgetAllocation };
    return this;
  }

  withFocusUnits(focusUnits: ReadonlyArray<FocusUnit>): this {
    this.props = { ...this.props, focusUnits };
    return this;
  }

  withAreaPriorities(areaPriorities: ReadonlyArray<AreaPriority>): this {
    this.props = { ...this.props, areaPriorities };
    return this;
  }

  withStatus(status: ObjectiveStatus): this {
    this.props = { ...this.props, status };
    return this;
  }

  withCreatedAt(createdAt: Date): this {
    this.props = { ...this.props, createdAt };
    return this;
  }

  withActivatedAt(activatedAt: Date | undefined): this {
    this.props = { ...this.props, activatedAt };
    return this;
  }

  withCompletedAt(completedAt: Date | undefined): this {
    this.props = { ...this.props, completedAt };
    return this;
  }

  build(): Result<Objective, ValidationError> {
    return Objective.create(this.props);
  }
}

function unwrapOrThrow<T>(result: Result<T, ValidationError>): T {
  // Unreachable in practice: every default literal above is valid by construction. Guards only
  // against a future edit introducing an invalid hardcoded default.
  /* v8 ignore next 3 */
  if (!result.ok) {
    throw new Error(`ObjectiveBuilder default construction failed: ${result.error.message}`);
  }
  return result.value;
}
