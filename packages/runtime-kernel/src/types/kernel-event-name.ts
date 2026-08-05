/** Named Kernel lifecycle events, published on the in-process KernelEventEmitter. */
export enum KernelEventName {
  KERNEL_STARTED = "kernel.started",
  KERNEL_STOPPED = "kernel.stopped",
  KERNEL_FAILED = "kernel.failed",
  KERNEL_RELOADED = "kernel.reloaded",
  CONFIGURATION_RELOADED = "kernel.configuration_reloaded",
  MODULE_LOADED = "kernel.module_loaded",
  PLUGIN_LOADED = "kernel.plugin_loaded",
  HEALTH_CHANGED = "kernel.health_changed",
}
