import { KnowledgePolicyException } from "./knowledge-policy-exception.js";

export class PolicyLeaseException extends KnowledgePolicyException {
  constructor(message: string) {
    super(message);
    this.name = "PolicyLeaseException";
  }
}
