/** Payload for the `aaos.objective.updated` event, emitted once per successful `UpdateObjective`. */
export interface ObjectiveUpdated {
  readonly objectiveId: string;
  readonly tenantId: string;
  readonly targetHotLeads: number;
  readonly budgetAllocation: number;
  readonly focusUnits: ReadonlyArray<string>;
  readonly areaPriorities: ReadonlyArray<string>;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
