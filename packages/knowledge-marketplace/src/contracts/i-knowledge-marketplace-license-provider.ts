/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgeMarketplaceLicenseProvider {
  checkLicense(listingId: string, tenantId: string): Promise<{ readonly licensed: boolean }>;
}
