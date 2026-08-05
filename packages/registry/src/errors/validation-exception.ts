import { RegistryException, type RegistryExceptionOptions } from "./registry-exception.js";

/** Raised when schema, business, dependency, version, or permission validation fails. */
export class ValidationException extends RegistryException {
  constructor(message: string, options?: RegistryExceptionOptions) {
    super(message, options);
  }
}
