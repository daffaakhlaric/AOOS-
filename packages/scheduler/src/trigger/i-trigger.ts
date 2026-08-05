import type { TriggerType } from "../contracts/trigger-type.js";

/** Marker port every concrete Trigger implements — Time/Manual/Dependency/Retry (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md — "TRIGGER"). */
export interface ITrigger {
  readonly type: TriggerType;
}
