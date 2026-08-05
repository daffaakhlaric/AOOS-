import type { WorkflowDefinition } from "../schemas/workflow-definition.js";
import type { IWorkflowValidator, ValidationResult } from "../validator/i-workflow-validator.js";
import { ValidationPipeline } from "../validator/validation-pipeline.js";

/** ValidationBuilder — fluent assembly of a `ValidationPipeline` with extra, caller-supplied validators. */
export class ValidationBuilder {
  private extraValidators: IWorkflowValidator[] = [];

  static create(): ValidationBuilder {
    return new ValidationBuilder();
  }

  withValidator(validator: IWorkflowValidator): this {
    this.extraValidators = [...this.extraValidators, validator];
    return this;
  }

  validate(workflow: WorkflowDefinition): ValidationResult {
    return new ValidationPipeline(this.extraValidators).run(workflow);
  }
}
