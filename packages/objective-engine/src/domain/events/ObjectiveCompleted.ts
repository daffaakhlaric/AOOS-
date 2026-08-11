/** Payload for the `aaos.objective.completed` event, emitted when `UpdateProgress` detects 100%-target-hit (spec edge case: "100% target hit early (COMPLETED)"). */
export interface ObjectiveCompleted {
  readonly objectiveId: string;
  readonly tenantId: string;
  readonly finalHotLeads: number;
  readonly targetHotLeads: number;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
