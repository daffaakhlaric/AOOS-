/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgeMarketplaceAnalyticsProvider {
  track(eventName: string, payload: Readonly<Record<string, unknown>>): Promise<void>;
}
