import { GraphValidator } from "./graph-validator.js";
import type {
  ExecutionValidationInput,
  ExecutionValidationResult,
  IExecutionValidator,
} from "./i-execution-validator.js";
import { NodeValidator } from "./node-validator.js";
import { RetryValidator } from "./retry-validator.js";
import { TimeoutValidator } from "./timeout-validator.js";
import { TransitionValidator } from "./transition-validator.js";

/**
 * "Execution Validator" (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md — "VALIDATION")
 * — runs Graph → Transition → Node → Timeout → Retry in order, aggregating every issue
 * (does not short-circuit).
 */
export class ExecutionValidationPipeline {
  private readonly validators: readonly IExecutionValidator[];

  constructor(extraValidators: readonly IExecutionValidator[] = []) {
    this.validators = [
      new GraphValidator(),
      new TransitionValidator(),
      new NodeValidator(),
      new TimeoutValidator(),
      new RetryValidator(),
      ...extraValidators,
    ];
  }

  run(input: ExecutionValidationInput): ExecutionValidationResult {
    const issues: ExecutionValidationResult["issues"][number][] = [];
    for (const validator of this.validators) {
      issues.push(...validator.validate(input).issues);
    }
    return { valid: issues.length === 0, issues };
  }
}
