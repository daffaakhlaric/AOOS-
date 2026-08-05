import { RegistryException, type RegistryExceptionOptions } from "./registry-exception.js";

/** Raised when a manifest fails its Zod schema — malformed structure, not a business rule. */
export class SchemaException extends RegistryException {
  constructor(message: string, options?: RegistryExceptionOptions) {
    super(message, options);
  }
}
