import { KernelException, type KernelExceptionOptions } from "./kernel-exception.js";

/** Raised when a lifecycle hook (OnBootstrap/OnReady/OnRunning/OnStopping/OnShutdown/OnDispose) fails. */
export class LifecycleException extends KernelException {
  constructor(message: string, options?: KernelExceptionOptions) {
    super(message, options);
  }
}
