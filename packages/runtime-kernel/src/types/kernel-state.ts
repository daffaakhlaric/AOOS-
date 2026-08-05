/**
 * Kernel State Machine states, per docs/PROMPT-005.2-CORE-RUNTIME-KERNEL.md:
 * Created → Booting → LoadingConfiguration → LoadingModules → LoadingPlugins → Ready →
 * Running → Stopping → Stopped → Restarting → Failed.
 */
export enum KernelState {
  CREATED = "created",
  BOOTING = "booting",
  LOADING_CONFIGURATION = "loading_configuration",
  LOADING_MODULES = "loading_modules",
  LOADING_PLUGINS = "loading_plugins",
  READY = "ready",
  RUNNING = "running",
  STOPPING = "stopping",
  STOPPED = "stopped",
  RESTARTING = "restarting",
  FAILED = "failed",
}

/**
 * The valid transition graph. Any transition not listed here is rejected by
 * KernelStateMachine — this is the single source of truth for "what can happen next."
 */
export const KERNEL_STATE_TRANSITIONS: Readonly<Record<KernelState, readonly KernelState[]>> = {
  [KernelState.CREATED]: [KernelState.BOOTING],
  [KernelState.BOOTING]: [KernelState.LOADING_CONFIGURATION, KernelState.FAILED],
  [KernelState.LOADING_CONFIGURATION]: [
    KernelState.LOADING_MODULES,
    KernelState.RUNNING, // reload() short-circuits back to RUNNING without reloading modules/plugins
    KernelState.FAILED,
  ],
  [KernelState.LOADING_MODULES]: [KernelState.LOADING_PLUGINS, KernelState.FAILED],
  [KernelState.LOADING_PLUGINS]: [KernelState.READY, KernelState.FAILED],
  [KernelState.READY]: [KernelState.RUNNING, KernelState.FAILED],
  [KernelState.RUNNING]: [
    KernelState.STOPPING,
    KernelState.LOADING_CONFIGURATION, // reload() re-enters configuration loading without a full stop
    KernelState.FAILED,
  ],
  [KernelState.STOPPING]: [KernelState.STOPPED, KernelState.FAILED],
  [KernelState.STOPPED]: [KernelState.RESTARTING, KernelState.BOOTING],
  [KernelState.RESTARTING]: [KernelState.BOOTING, KernelState.FAILED],
  [KernelState.FAILED]: [KernelState.RESTARTING, KernelState.STOPPED],
};

/** States in which the Kernel is considered "alive" for liveness-probe purposes. */
export const LIVE_STATES: ReadonlySet<KernelState> = new Set([
  KernelState.BOOTING,
  KernelState.LOADING_CONFIGURATION,
  KernelState.LOADING_MODULES,
  KernelState.LOADING_PLUGINS,
  KernelState.READY,
  KernelState.RUNNING,
  KernelState.STOPPING,
  KernelState.RESTARTING,
]);

/** States in which the Kernel is considered "ready" to serve for readiness-probe purposes. */
export const READY_STATES: ReadonlySet<KernelState> = new Set([
  KernelState.READY,
  KernelState.RUNNING,
]);
