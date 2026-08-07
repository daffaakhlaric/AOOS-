import { KnowledgePolicyException } from "./knowledge-policy-exception.js";

export class PolicySessionException extends KnowledgePolicyException {
  constructor(message: string) {
    super(message);
    this.name = "PolicySessionException";
  }
}
