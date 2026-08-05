import { RegistryException, type RegistryExceptionOptions } from "./registry-exception.js";

/** Raised for invalid version strings, downgrade attempts, or backward-incompatibility. */
export class VersionException extends RegistryException {
  constructor(message: string, options?: RegistryExceptionOptions) {
    super(message, options);
  }
}
