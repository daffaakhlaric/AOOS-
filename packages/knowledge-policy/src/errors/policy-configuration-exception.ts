import { KnowledgePolicyException } from "./knowledge-policy-exception.js";

export class PolicyConfigurationException extends KnowledgePolicyException {
  constructor(message: string) {
    super(message);
    this.name = "PolicyConfigurationException";
  }
}
