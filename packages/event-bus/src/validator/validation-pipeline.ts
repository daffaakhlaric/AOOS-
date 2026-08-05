import type { BaseEventShape } from "../contracts/base-event.js";

import type { IEventValidator, ValidationContext, ValidationResult } from "./i-event-validator.js";
import { PayloadValidator } from "./payload-validator.js";
import { SchemaValidator } from "./schema-validator.js";
import { TenantValidator } from "./tenant-validator.js";
import { VersionValidator } from "./version-validator.js";

/**
 * Runs Schema → Version → Payload → Tenant in order, aggregating every issue (does not
 * short-circuit on the first failure, so a caller sees every problem in one round-trip).
 * Permission Validation is deliberately excluded — see i-permission-validator.ts.
 */
export class ValidationPipeline {
  private readonly validators: readonly IEventValidator[];

  constructor(extraValidators: readonly IEventValidator[] = []) {
    this.validators = [
      new SchemaValidator(),
      new VersionValidator(),
      new PayloadValidator(),
      new TenantValidator(),
      ...extraValidators,
    ];
  }

  run(event: BaseEventShape, context: ValidationContext): ValidationResult {
    const issues: ValidationResult["issues"][number][] = [];
    for (const validator of this.validators) {
      const result = validator.validate(event, context);
      issues.push(...result.issues);
    }
    return { valid: issues.length === 0, issues };
  }
}
