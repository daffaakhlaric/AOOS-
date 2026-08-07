/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgeMarketplaceApprovalProvider {
  approvePublisher(publisherId: string): Promise<{ readonly approved: boolean }>;
}
