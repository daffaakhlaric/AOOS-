import {
  WorkflowDefinitionException,
  type WorkflowDefinitionExceptionOptions,
} from "./workflow-definition-exception.js";

/** Raised for an unintended cycle in the Transition graph (Cycle Detection) — an intentional `LoopNode` cycle never raises this. */
export class CycleException extends WorkflowDefinitionException {
  constructor(message: string, options?: WorkflowDefinitionExceptionOptions) {
    super(message, options);
  }
}
