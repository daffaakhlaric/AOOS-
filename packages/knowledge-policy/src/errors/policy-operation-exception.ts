import { KnowledgePolicyException } from "./knowledge-policy-exception.js";

export class PolicyOperationException extends KnowledgePolicyException {
  constructor(message: string) {
    super(message);
    this.name = "PolicyOperationException";
  }
}
