/** Named Kernel-level extension points (cross-cutting hooks, distinct from component Lifecycle interfaces). */
export enum HookName {
  BEFORE_START = "before_start",
  AFTER_START = "after_start",
  BEFORE_STOP = "before_stop",
  AFTER_STOP = "after_stop",
  BEFORE_RELOAD = "before_reload",
  AFTER_RELOAD = "after_reload",
}
