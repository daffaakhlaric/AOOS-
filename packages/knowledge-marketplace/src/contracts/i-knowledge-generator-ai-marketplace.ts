/** Future-readiness contract for 005.7K Knowledge Generator AI — interface only, no implementation. */
export interface IKnowledgeGeneratorAiMarketplace {
  describeListingForGeneration(listingId: string): Promise<{ readonly summary: string }>;
}
