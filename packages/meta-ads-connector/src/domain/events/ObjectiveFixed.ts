/** Payload for the `aaos.meta.objective.fixed` event, emitted after `ExecuteVerdict` successfully fixes a campaign's objective. */
export interface ObjectiveFixed {
  readonly campaignId: string;
  readonly previousObjective: string;
  readonly newObjective: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
