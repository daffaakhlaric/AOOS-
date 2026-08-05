import { RegistryException, type RegistryExceptionOptions } from "./registry-exception.js";

/** Raised when the Resolver cannot resolve an entry/version/tag reference to a concrete entry. */
export class ResolutionException extends RegistryException {
  constructor(message: string, options?: RegistryExceptionOptions) {
    super(message, options);
  }
}
