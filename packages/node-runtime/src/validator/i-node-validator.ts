import type { NodeExecution } from "../instance/node-execution.js";

export interface NodeValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface NodeValidationResult {
  readonly valid: boolean;
  readonly issues: readonly NodeValidationIssue[];
}

/** One stage of the Node Validation pipeline (Schema/Configuration/Compatibility/Input/Output/Dependency/Version — docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md — "NODE VALIDATION"). */
export interface INodeValidator {
  readonly name: string;
  validate(execution: NodeExecution): NodeValidationResult;
}
