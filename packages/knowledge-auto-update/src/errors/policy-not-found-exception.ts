import { KnowledgeAutoUpdateException } from "./knowledge-auto-update-exception.js";

export class PolicyNotFoundException extends KnowledgeAutoUpdateException {
  constructor(policyId: string) {
    super(`Knowledge update policy not found: ${policyId}`, {
      code: "POLICY_NOT_FOUND",
      context: { policyId },
    });
  }
}
