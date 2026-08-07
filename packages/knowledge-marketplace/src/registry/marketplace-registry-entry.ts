import type { MarketplaceMetadata } from "../domain/marketplace-metadata.js";

/** The `LISTING` bucket entry — one row per registered `MarketplaceListing`. */
export interface MarketplaceRegistryEntry {
  readonly id: string;
  readonly token: string;
  readonly metadata: MarketplaceMetadata;
}
