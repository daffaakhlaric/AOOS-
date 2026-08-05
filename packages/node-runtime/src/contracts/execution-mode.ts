/** How a Node Instance's execution should behave — interpreted by the future Execution Engine (005.6D); this package only carries the mode, it never branches on it to execute anything. */
export enum ExecutionMode {
  NORMAL = "normal",
  SIMULATION = "simulation",
  DEBUG = "debug",
  DRY_RUN = "dry_run",
  STEP_BY_STEP = "step_by_step",
}
