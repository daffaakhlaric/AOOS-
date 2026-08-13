/** Payload for `aaos.closing-tracker.objective.completed`, emitted by `CheckObjectiveCompletion` when `achievedSpk >= targetSpk`. */
export interface ObjectiveCompleted {
  readonly targetSpk: number;
  readonly achievedSpk: number;
  readonly periodLabel: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
