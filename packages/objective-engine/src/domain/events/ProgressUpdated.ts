import type { OnTrackStatus } from "../value-objects/OnTrackStatus.js";

/** Payload for the `aaos.objective.progress.updated` event, emitted once per `UpdateProgress` call. */
export interface ProgressUpdated {
  readonly objectiveId: string;
  readonly tenantId: string;
  readonly currentHotLeads: number;
  readonly progressPercentage: number;
  readonly onTrackStatus: OnTrackStatus;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
