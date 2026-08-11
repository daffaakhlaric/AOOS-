/** Payload for the `aaos.objective.created` event, emitted once per successful `CreateObjective`. */
export interface ObjectiveCreated {
  readonly objectiveId: string;
  readonly tenantId: string;
  readonly period: { readonly month: number; readonly year: number };
  readonly targetHotLeads: number;
  readonly budgetAllocation: number;
  readonly focusUnits: ReadonlyArray<string>;
  readonly areaPriorities: ReadonlyArray<string>;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
