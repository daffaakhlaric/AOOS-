import { KernelException, type KernelExceptionOptions } from "./kernel-exception.js";

/** Raised by ModuleLoader when a module fails to register, load, or unload. */
export class ModuleException extends KernelException {
  constructor(message: string, options?: KernelExceptionOptions) {
    super(message, options);
  }
}
