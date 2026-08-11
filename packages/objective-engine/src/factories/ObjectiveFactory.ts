import { err, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import { Objective } from "../domain/entities/Objective.js";
import { AreaPriority } from "../domain/value-objects/AreaPriority.js";
import { BudgetAllocation } from "../domain/value-objects/BudgetAllocation.js";
import { FocusUnit } from "../domain/value-objects/FocusUnit.js";
import type { ObjectiveId } from "../domain/value-objects/ObjectiveId.js";
import { ObjectivePeriod } from "../domain/value-objects/ObjectivePeriod.js";
import type { ObjectiveStatus } from "../domain/value-objects/ObjectiveStatus.js";
import { TargetLeads } from "../domain/value-objects/TargetLeads.js";

export interface ObjectiveFactoryInput {
  readonly id: ObjectiveId;
  readonly tenantId: string;
  readonly period: { readonly month: number; readonly year: number };
  readonly targetHotLeads: number;
  readonly budgetAllocation: number;
  readonly focusUnits: ReadonlyArray<string>;
  readonly areaPriorities: ReadonlyArray<string>;
  readonly status: ObjectiveStatus;
  readonly createdAt: Date;
  readonly activatedAt?: Date;
  readonly completedAt?: Date;
}

/**
 * Factory Pattern class turning raw primitives into a fully-validated `Objective` — the single
 * place that constructs every one of `Objective`'s Value Object fields from primitive input, so
 * `CreateObjective` (and any future caller assembling an `Objective` from raw data) doesn't
 * duplicate that Value-Object-construction sequence.
 */
export class ObjectiveFactory {
  static create(input: ObjectiveFactoryInput): Result<Objective, ValidationError> {
    const periodResult = ObjectivePeriod.create(input.period);
    if (!periodResult.ok) {
      return periodResult;
    }
    const targetResult = TargetLeads.create(input.targetHotLeads);
    if (!targetResult.ok) {
      return targetResult;
    }
    const budgetResult = BudgetAllocation.create(input.budgetAllocation);
    if (!budgetResult.ok) {
      return budgetResult;
    }

    const focusUnits = [];
    for (const raw of input.focusUnits) {
      const result = FocusUnit.create(raw);
      if (!result.ok) {
        return err(result.error);
      }
      focusUnits.push(result.value);
    }

    const areaPriorities = [];
    for (const raw of input.areaPriorities) {
      const result = AreaPriority.create(raw);
      if (!result.ok) {
        return err(result.error);
      }
      areaPriorities.push(result.value);
    }

    return Objective.create({
      id: input.id,
      tenantId: input.tenantId,
      period: periodResult.value,
      targetHotLeads: targetResult.value,
      budgetAllocation: budgetResult.value,
      focusUnits,
      areaPriorities,
      status: input.status,
      createdAt: input.createdAt,
      ...(input.activatedAt !== undefined ? { activatedAt: input.activatedAt } : {}),
      ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
    });
  }
}
