import type { MarketplaceMetadata } from "../domain/marketplace-metadata.js";
import type { MarketplacePackageStatus } from "../domain/marketplace-package-status.js";

/**
 * Interface only — no implementation in this package beyond the concrete
 * `KnowledgeMarketplaceRecord` view class. The minimal read-only shape any
 * "live listing" object must satisfy.
 */
export interface IKnowledgeMarketplace {
  readonly id: string;
  readonly token: string;
  readonly listingId: string;
  readonly packageId: string;
  readonly state: MarketplacePackageStatus;
  readonly metadata: MarketplaceMetadata;
}
