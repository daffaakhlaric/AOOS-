import { KnowledgePolicyException } from "./knowledge-policy-exception.js";

export class PolicyPermissionDeniedException extends KnowledgePolicyException {
  constructor(message: string) {
    super(message);
    this.name = "PolicyPermissionDeniedException";
  }
}
