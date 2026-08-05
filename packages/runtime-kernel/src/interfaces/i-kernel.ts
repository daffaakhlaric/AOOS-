import type { RuntimeContext } from "../context/index.js";
import type { KernelState } from "../types/index.js";

/** The core Kernel bootstrap contract — the minimal shape any Kernel implementation exposes. */
export interface IKernel {
  readonly state: KernelState;
  readonly context: RuntimeContext;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  dispose(): Promise<void>;
  reload(): Promise<void>;
}
