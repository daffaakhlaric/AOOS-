/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgeMarketplaceSearchProvider {
  search(keyword: string): Promise<readonly string[]>;
}
