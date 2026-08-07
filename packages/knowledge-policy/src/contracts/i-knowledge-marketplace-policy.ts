/** Future-readiness contract for 005.7J Knowledge Marketplace — interface only, no implementation. */
export interface IKnowledgeMarketplacePolicy {
  evaluateMarketplacePolicy(policyId: string, listingId: string): Promise<{ allowed: boolean }>;
}
