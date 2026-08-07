/** Future-readiness contract for 005.7M Knowledge Validator AI — interface only, no implementation. */
export interface IKnowledgeValidatorAiPolicy {
  evaluateValidationPolicy(
    policyId: string,
    validationId: string,
  ): Promise<{ valid: boolean; confidence: number }>;
}
