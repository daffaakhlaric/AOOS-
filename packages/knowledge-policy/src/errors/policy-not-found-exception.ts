import { KnowledgePolicyException } from "./knowledge-policy-exception.js";

export class PolicyNotFoundException extends KnowledgePolicyException {
  constructor(message: string) {
    super(message);
    this.name = "PolicyNotFoundException";
  }
}
