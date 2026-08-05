import { KernelException, type KernelExceptionOptions } from "./kernel-exception.js";

/** Raised when configuration loading, validation, or reload fails. */
export class ConfigurationException extends KernelException {
  constructor(message: string, options?: KernelExceptionOptions) {
    super(message, options);
  }
}
