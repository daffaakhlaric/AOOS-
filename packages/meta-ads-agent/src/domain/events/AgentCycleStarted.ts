/** Payload for `aaos.samantha.cycle.started`, emitted at the start of every `RunOptimizationCycle`. */
export interface AgentCycleStarted {
  readonly tenantId: string;
  readonly agentId: string;
  readonly adAccountId: string;
  readonly objectiveId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
