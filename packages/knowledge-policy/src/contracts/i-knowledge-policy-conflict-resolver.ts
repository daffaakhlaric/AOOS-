/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgePolicyConflictResolver {
  resolve(policyIds: readonly string[], targetId: string): Promise<string>;
}
