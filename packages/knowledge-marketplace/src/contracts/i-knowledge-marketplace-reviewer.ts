/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgeMarketplaceReviewer {
  review(listingId: string): Promise<{ readonly approved: boolean; readonly notes?: string }>;
}
