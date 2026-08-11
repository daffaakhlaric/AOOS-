import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { AreaPriority } from "../value-objects/AreaPriority.js";
import type { BudgetAllocation } from "../value-objects/BudgetAllocation.js";
import type { FocusUnit } from "../value-objects/FocusUnit.js";
import type { ObjectiveId } from "../value-objects/ObjectiveId.js";
import type { ObjectivePeriod } from "../value-objects/ObjectivePeriod.js";
import { ObjectiveStatus } from "../value-objects/ObjectiveStatus.js";
import type { TargetLeads } from "../value-objects/TargetLeads.js";

export interface ObjectiveProps {
  readonly id: ObjectiveId;
  readonly tenantId: string;
  readonly period: ObjectivePeriod;
  readonly targetHotLeads: TargetLeads;
  readonly budgetAllocation: BudgetAllocation;
  readonly focusUnits: ReadonlyArray<FocusUnit>;
  readonly areaPriorities: ReadonlyArray<AreaPriority>;
  readonly status: ObjectiveStatus;
  readonly createdAt: Date;
  readonly activatedAt?: Date;
  readonly completedAt?: Date;
}

/** DSS Motor's monthly lead objective — the aggregate root of this package (spec: "Objective (Entity)"). */
export class Objective {
  private constructor(private readonly props: ObjectiveProps) {}

  static create(props: ObjectiveProps): Result<Objective, ValidationError> {
    if (typeof props.tenantId !== "string" || props.tenantId.trim().length === 0) {
      return err(new ValidationError("Objective.tenantId must be a non-empty string"));
    }
    if (props.focusUnits.length === 0) {
      return err(new ValidationError("Objective.focusUnits must contain at least one FocusUnit"));
    }
    if (props.areaPriorities.length === 0) {
      return err(
        new ValidationError("Objective.areaPriorities must contain at least one AreaPriority"),
      );
    }
    if (!Object.values(ObjectiveStatus).includes(props.status)) {
      return err(
        new ValidationError(
          `Objective.status must be a valid ObjectiveStatus, received: ${String(props.status)}`,
        ),
      );
    }
    return ok(
      new Objective({
        ...props,
        focusUnits: [...props.focusUnits],
        areaPriorities: [...props.areaPriorities],
      }),
    );
  }

  get id(): ObjectiveId {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get period(): ObjectivePeriod {
    return this.props.period;
  }

  get targetHotLeads(): TargetLeads {
    return this.props.targetHotLeads;
  }

  get budgetAllocation(): BudgetAllocation {
    return this.props.budgetAllocation;
  }

  get focusUnits(): ReadonlyArray<FocusUnit> {
    return this.props.focusUnits;
  }

  get areaPriorities(): ReadonlyArray<AreaPriority> {
    return this.props.areaPriorities;
  }

  get status(): ObjectiveStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get activatedAt(): Date | undefined {
    return this.props.activatedAt;
  }

  get completedAt(): Date | undefined {
    return this.props.completedAt;
  }

  /** Returns a new `ACTIVE` Objective, stamping `activatedAt`. Immutable — never mutates `this`. */
  activate(activatedAt: Date): Objective {
    return new Objective({ ...this.props, status: ObjectiveStatus.ACTIVE, activatedAt });
  }

  /** Returns a new `COMPLETED` Objective, stamping `completedAt`. */
  complete(completedAt: Date): Objective {
    return new Objective({ ...this.props, status: ObjectiveStatus.COMPLETED, completedAt });
  }

  /** Returns a new `CANCELLED` Objective. */
  cancel(): Objective {
    return new Objective({ ...this.props, status: ObjectiveStatus.CANCELLED });
  }

  /** Returns a shallow-cloned Objective with updated mutable fields (target/budget/focus/areas) — the immutable parts of `UpdateObjective`. */
  withUpdates(
    updates: Partial<
      Pick<ObjectiveProps, "targetHotLeads" | "budgetAllocation" | "focusUnits" | "areaPriorities">
    >,
  ): Objective {
    return new Objective({
      ...this.props,
      ...updates,
      focusUnits: updates.focusUnits ? [...updates.focusUnits] : this.props.focusUnits,
      areaPriorities: updates.areaPriorities
        ? [...updates.areaPriorities]
        : this.props.areaPriorities,
    });
  }
}
