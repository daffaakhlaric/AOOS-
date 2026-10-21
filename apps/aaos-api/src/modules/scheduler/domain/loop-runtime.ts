import { z } from "zod";

/** Initial bridge uses the existing scheduler. Provider/business event adapters follow separately. */
export const LoopTriggerSchema = z
  .object({
    type: z.literal("scheduler.event.due.v1"),
    version: z.literal(1),
    eventId: z.string().uuid(),
    tenantId: z.string().min(1),
    entityId: z.string().min(1),
    correlationId: z.string().uuid(),
    occurredAt: z.string().datetime({ offset: true }),
    payload: z.object({ calendarEventType: z.string().min(1) }),
  })
  .strict();
export type LoopTrigger = z.infer<typeof LoopTriggerSchema>;

export const LoopStages = [
  "OBSERVING",
  "DETECTING",
  "DIAGNOSING",
  "DECIDING",
  "POLICY_CHECK",
  "AWAITING_APPROVAL",
  "EXECUTING",
  "WAITING_FOR_KAI",
  "WAITING_FOR_QA",
  "WAITING_FOR_SIMULATION",
  "WAITING_FOR_META",
  "MONITORING",
  "VALIDATING",
  "LEARNING",
  "COMPLETED",
  "BLOCKED",
  "FAILED",
] as const;
export type LoopStage = (typeof LoopStages)[number];
const transitions: Record<LoopStage, readonly LoopStage[]> = {
  OBSERVING: ["DETECTING", "COMPLETED"],
  DETECTING: ["DIAGNOSING", "COMPLETED"],
  DIAGNOSING: ["DECIDING"],
  DECIDING: ["POLICY_CHECK"],
  POLICY_CHECK: ["AWAITING_APPROVAL", "EXECUTING", "MONITORING", "COMPLETED"],
  AWAITING_APPROVAL: ["POLICY_CHECK"],
  EXECUTING: ["WAITING_FOR_KAI", "WAITING_FOR_META", "MONITORING"],
  WAITING_FOR_KAI: ["WAITING_FOR_QA"],
  WAITING_FOR_QA: ["WAITING_FOR_KAI", "WAITING_FOR_SIMULATION", "POLICY_CHECK"],
  WAITING_FOR_SIMULATION: ["WAITING_FOR_KAI", "POLICY_CHECK"],
  WAITING_FOR_META: ["MONITORING"],
  MONITORING: ["VALIDATING"],
  VALIDATING: ["LEARNING", "MONITORING"],
  LEARNING: ["COMPLETED"],
  COMPLETED: [],
  BLOCKED: [],
  FAILED: [],
};
/** Terminal/uncertain executions cannot be reopened by a generic event retry. */
export function assertLoopTransition(from: LoopStage, to: LoopStage): void {
  if (transitions[from].includes(to)) return;
  if (!["COMPLETED", "BLOCKED", "FAILED"].includes(from) && ["BLOCKED", "FAILED"].includes(to))
    return;
  throw new Error("INVALID_LOOP_TRANSITION");
}
