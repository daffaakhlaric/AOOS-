/** Payload for the `aaos.meta.budget.scaled` event, emitted after `ExecuteVerdict` successfully scales an adset's budget. */
export interface BudgetScaled {
  readonly adSetId: string;
  readonly previousBudget: number;
  readonly newBudget: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
