import { KnowledgePolicyException } from "./knowledge-policy-exception.js";

export class PolicyEvaluationException extends KnowledgePolicyException {
  constructor(message: string) {
    super(message);
    this.name = "PolicyEvaluationException";
  }
}
