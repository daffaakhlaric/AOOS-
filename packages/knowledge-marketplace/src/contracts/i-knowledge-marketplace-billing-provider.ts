/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgeMarketplaceBillingProvider {
  charge(
    listingId: string,
    tenantId: string,
    amount: number,
  ): Promise<{ readonly chargeId: string }>;
}
