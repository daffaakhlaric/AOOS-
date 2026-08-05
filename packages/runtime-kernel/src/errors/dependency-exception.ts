import { KernelException, type KernelExceptionOptions } from "./kernel-exception.js";

/** Raised by the Service Container: unresolvable token, circular dependency, or duplicate registration. */
export class DependencyException extends KernelException {
  constructor(message: string, options?: KernelExceptionOptions) {
    super(message, options);
  }
}
