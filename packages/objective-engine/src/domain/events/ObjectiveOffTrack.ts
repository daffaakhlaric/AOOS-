/** Payload for the `aaos.objective.off-track` event, emitted by `UpdateProgress` whenever the pacing ratio falls below the AT_RISK/OFF_TRACK boundary (ratio < atRiskThreshold, default 0.60). */
export interface ObjectiveOffTrack {
  readonly objectiveId: string;
  readonly tenantId: string;
  readonly ratio: number;
  readonly currentHotLeads: number;
  readonly targetHotLeads: number;
  readonly daysRemaining: number;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
