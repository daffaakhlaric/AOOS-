/** Payload for `aaos.samantha.error`, emitted whenever a cycle stage encounters a recoverable `AgentError`. */
export interface AgentError {
  readonly tenantId: string;
  readonly stage: "PERCEIVE" | "ANALYZE" | "DECIDE" | "ACT" | "REPORT" | "LEARN";
  readonly code: string;
  readonly message: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
