/** Payload for `aaos.tamara.cycle.completed`, emitted once a `RunOptimizationCycle` finishes. */
export interface AgentCycleCompleted {
  readonly tenantId: string;
  readonly agentId: string;
  readonly executionPlanId: string;
  readonly totalDecisions: number;
  readonly autoExecutedCount: number;
  readonly escalatedCount: number;
  readonly briefedToKaiCount: number;
  readonly noActionCount: number;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
