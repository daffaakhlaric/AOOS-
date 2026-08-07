import { KnowledgePolicyException } from "./knowledge-policy-exception.js";

export class PolicyViolationException extends KnowledgePolicyException {
  constructor(message: string) {
    super(message);
    this.name = "PolicyViolationException";
  }
}
