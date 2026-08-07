import { KnowledgePolicyException } from "./knowledge-policy-exception.js";

export class DuplicatePolicyEntryException extends KnowledgePolicyException {
  constructor(message: string) {
    super(message);
    this.name = "DuplicatePolicyEntryException";
  }
}
