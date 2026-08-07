import { KnowledgePolicyException } from "./knowledge-policy-exception.js";

export class PolicyValidationException extends KnowledgePolicyException {
  constructor(message: string) {
    super(message);
    this.name = "PolicyValidationException";
  }
}
