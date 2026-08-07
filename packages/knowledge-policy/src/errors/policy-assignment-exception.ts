import { KnowledgePolicyException } from "./knowledge-policy-exception.js";

export class PolicyAssignmentException extends KnowledgePolicyException {
  constructor(message: string) {
    super(message);
    this.name = "PolicyAssignmentException";
  }
}
