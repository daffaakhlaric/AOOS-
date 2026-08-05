import { KernelException, type KernelExceptionOptions } from "./kernel-exception.js";

/** Raised when the Kernel fails to bootstrap (any step of start() before reaching RUNNING). */
export class BootstrapException extends KernelException {
  constructor(message: string, options?: KernelExceptionOptions) {
    super(message, options);
  }
}
