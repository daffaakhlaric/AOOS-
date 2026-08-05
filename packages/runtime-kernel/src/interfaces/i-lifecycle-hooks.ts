import type { RuntimeContext } from "../context/index.js";

/** Implemented by a Module/Plugin that wants to run code when the Kernel finishes booting, before Ready. */
export interface OnBootstrap {
  onBootstrap(context: RuntimeContext): void | Promise<void>;
}

/** Implemented by a Module/Plugin that wants to run code the moment the Kernel reaches READY. */
export interface OnReady {
  onReady(context: RuntimeContext): void | Promise<void>;
}

/** Implemented by a Module/Plugin that wants to run code the moment the Kernel reaches RUNNING. */
export interface OnRunning {
  onRunning(context: RuntimeContext): void | Promise<void>;
}

/** Implemented by a Module/Plugin that wants to run code when the Kernel begins stopping. */
export interface OnStopping {
  onStopping(context: RuntimeContext): void | Promise<void>;
}

/** Implemented by a Module/Plugin that wants to run code during shutdown, before final disposal. */
export interface OnShutdown {
  onShutdown(context: RuntimeContext): void | Promise<void>;
}

/** Implemented by a Module/Plugin that wants to run final, non-recoverable cleanup (e.g. closing handles). */
export interface OnDispose {
  onDispose(context: RuntimeContext): void | Promise<void>;
}

/** A component may implement any subset of the six lifecycle interfaces above. */
export type LifecycleParticipant = Partial<
  OnBootstrap & OnReady & OnRunning & OnStopping & OnShutdown & OnDispose
>;
