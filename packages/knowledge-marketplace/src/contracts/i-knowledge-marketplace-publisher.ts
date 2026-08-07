/** Extension Point — interface only, no implementation in this package. Not the event publisher. */
export interface IKnowledgeMarketplacePublisher {
  publishListing(listingId: string): Promise<void>;
}
