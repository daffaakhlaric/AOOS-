import type { Objective } from "@aos/objective-engine";

/** JSON-serializable projection of an `Objective` domain entity — every value object flattened to its primitive form (mirrors `LeadResponseDto`'s convention). */
export interface ObjectiveResponseDto {
  readonly id: string;
  readonly tenantId: string;
  readonly period: { readonly month: number; readonly year: number };
  readonly targetHotLeads: number;
  readonly budgetAllocation: number;
  readonly focusUnits: readonly string[];
  readonly areaPriorities: readonly string[];
  readonly status: string;
  readonly createdAt: string;
  readonly activatedAt?: string;
  readonly completedAt?: string;
}

export function toObjectiveResponseDto(objective: Objective): ObjectiveResponseDto {
  return {
    id: objective.id.toString(),
    tenantId: objective.tenantId,
    period: { month: objective.period.monthNumber, year: objective.period.yearNumber },
    targetHotLeads: objective.targetHotLeads.toNumber(),
    budgetAllocation: objective.budgetAllocation.toNumber(),
    focusUnits: objective.focusUnits.map((f) => f.toString()),
    areaPriorities: objective.areaPriorities.map((a) => a.toBranch().toString()),
    status: objective.status,
    createdAt: objective.createdAt.toISOString(),
    activatedAt: objective.activatedAt?.toISOString(),
    completedAt: objective.completedAt?.toISOString(),
  };
}
