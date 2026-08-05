import { RegistryException, type RegistryExceptionOptions } from "./registry-exception.js";

/** Raised for circular, missing, or incompatible-version dependencies. */
export class DependencyException extends RegistryException {
  constructor(message: string, options?: RegistryExceptionOptions) {
    super(message, options);
  }
}
