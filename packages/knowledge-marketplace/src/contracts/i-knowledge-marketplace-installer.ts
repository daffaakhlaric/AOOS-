/**
 * Extension Point — interface only, no implementation in this package. "This package
 * DOES NOT execute knowledge. It only manages Marketplace metadata." — no installer
 * exists inside this package; this contract exists solely so a future package can
 * implement package installation against Marketplace metadata without this package
 * ever performing a download, install, or deployment.
 */
export interface IKnowledgeMarketplaceInstaller {
  install(listingId: string): Promise<void>;
}
