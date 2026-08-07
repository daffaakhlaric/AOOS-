/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgeComplianceProvider {
  checkCompliance(
    policyId: string,
    targetId: string,
  ): Promise<{ compliant: boolean; details: Readonly<Record<string, unknown>> }>;
}
