/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgeMarketplaceRecommendationProvider {
  recommend(tenantId: string, limit?: number): Promise<readonly string[]>;
}
