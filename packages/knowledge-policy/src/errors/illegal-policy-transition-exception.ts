import { KnowledgePolicyException } from "./knowledge-policy-exception.js";

export class IllegalPolicyTransitionException extends KnowledgePolicyException {
  constructor(message: string) {
    super(message);
    this.name = "IllegalPolicyTransitionException";
  }
}
