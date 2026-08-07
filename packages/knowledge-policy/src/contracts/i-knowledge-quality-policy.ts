/** Future-readiness contract for 005.7L Knowledge Quality Engine — interface only, no implementation. */
export interface IKnowledgeQualityPolicy {
  evaluateQualityPolicy(
    policyId: string,
    assetId: string,
  ): Promise<{ score: number; passed: boolean }>;
}
