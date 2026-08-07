import { KnowledgePolicyException } from "./knowledge-policy-exception.js";

export class PolicyRuleException extends KnowledgePolicyException {
  constructor(message: string) {
    super(message);
    this.name = "PolicyRuleException";
  }
}
