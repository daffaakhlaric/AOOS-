import { RetryStrategy } from "../retry/retry-policy.js";

import type {
  ExecutionValidationInput,
  ExecutionValidationResult,
  IExecutionValidator,
} from "./i-execution-validator.js";

/** "Retry Validator" — a configured Retry Policy (if any) has a positive `maxAttempts`, and a `customDelayFn` when `strategy === CUSTOM`. */
export class RetryValidator implements IExecutionValidator {
  readonly name = "retry";

  validate(input: ExecutionValidationInput): ExecutionValidationResult {
    const issues: ExecutionValidationResult["issues"][number][] = [];
    const policy = input.retryPolicy;
    if (policy) {
      if (policy.maxAttempts <= 0) {
        issues.push({
          path: "retryPolicy.maxAttempts",
          message: "maxAttempts must be a positive number",
        });
      }
      if (policy.strategy === RetryStrategy.CUSTOM && !policy.customDelayFn) {
        issues.push({
          path: "retryPolicy.customDelayFn",
          message: "customDelayFn is required when strategy is CUSTOM",
        });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
