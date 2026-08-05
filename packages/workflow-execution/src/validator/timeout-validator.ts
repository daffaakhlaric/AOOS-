import type {
  ExecutionValidationInput,
  ExecutionValidationResult,
  IExecutionValidator,
} from "./i-execution-validator.js";

/** "Timeout Validator" — every configured timeout (if any) must be a positive number. */
export class TimeoutValidator implements IExecutionValidator {
  readonly name = "timeout";

  validate(input: ExecutionValidationInput): ExecutionValidationResult {
    const issues: ExecutionValidationResult["issues"][number][] = [];
    const timeouts = input.timeouts;
    if (timeouts) {
      for (const [key, value] of Object.entries(timeouts)) {
        if (value !== undefined && (typeof value !== "number" || value <= 0)) {
          issues.push({ path: `timeouts.${key}`, message: `"${key}" must be a positive number` });
        }
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
