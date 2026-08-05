import type { BaseEventShape } from "../contracts/base-event.js";

import type { IEventValidator, ValidationContext, ValidationResult } from "./i-event-validator.js";

/**
 * Payload Validation — if `context.payloadSchemasByType` declares a Zod schema for this
 * event's `type`, the payload must satisfy it. An event whose `type` has no registered
 * payload schema always passes (payload shape is producer-defined until one is registered).
 */
export class PayloadValidator implements IEventValidator {
  readonly name = "payload";

  validate(event: BaseEventShape, context: ValidationContext): ValidationResult {
    const schema = context.payloadSchemasByType?.get(event.type);
    if (!schema) {
      return { valid: true, issues: [] };
    }
    const result = schema.safeParse(event.payload);
    if (result.success) {
      return { valid: true, issues: [] };
    }
    return {
      valid: false,
      issues: result.error.issues.map((issue) => ({
        path: `payload.${issue.path.join(".")}`,
        message: issue.message,
      })),
    };
  }
}
