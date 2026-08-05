/** Supported Schedule kinds (docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md — "Supported Schedule"). Event Trigger is explicitly future/not implemented. */
export enum ScheduleType {
  ONE_TIME = "one_time",
  RECURRING = "recurring",
  INTERVAL = "interval",
  CRON = "cron",
  CALENDAR = "calendar",
  DELAYED = "delayed",
  DEPENDENCY = "dependency",
  MANUAL = "manual",
}
