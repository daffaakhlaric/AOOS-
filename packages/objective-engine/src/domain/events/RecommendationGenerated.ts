/** Payload for the `aaos.objective.recommendation` event, emitted once per successful `GenerateRecommendation`. */
export interface RecommendationGenerated {
  readonly objectiveId: string;
  readonly tenantId: string;
  readonly actionCount: number;
  readonly confidence: number;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
