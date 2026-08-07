/** Future-readiness contract for 005.7K Knowledge Generator AI — interface only, no implementation. */
export interface IKnowledgeGeneratorPolicy {
  evaluateGenerationPolicy(policyId: string, generatorId: string): Promise<{ allowed: boolean }>;
}
