/** Trigger kinds (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md — "Trigger"). */
export enum TriggerType {
  TIME = "time",
  MANUAL = "manual",
  DEPENDENCY = "dependency",
  RETRY = "retry",
}
