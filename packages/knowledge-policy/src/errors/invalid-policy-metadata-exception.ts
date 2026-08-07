import { KnowledgePolicyException } from "./knowledge-policy-exception.js";

export class InvalidPolicyMetadataException extends KnowledgePolicyException {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPolicyMetadataException";
  }
}
