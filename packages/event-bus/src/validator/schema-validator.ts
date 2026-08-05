import type { BaseEventShape } from "../contracts/base-event.js";
import { baseEventSchema } from "../contracts/base-event.js";

import type { IEventValidator, ValidationContext, ValidationResult } from "./i-event-validator.js";

/** Schema Validation — every event must satisfy `baseEventSchema` regardless of category. */
export class SchemaValidator implements IEventValidator {
  readonly name = "schema";

  validate(event: BaseEventShape, _context: ValidationContext): ValidationResult {
    const result = baseEventSchema.safeParse(event);
    if (result.success) {
      return { valid: true, issues: [] };
    }
    return {
      valid: false,
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
}
