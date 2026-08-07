import { MarketplaceCategoryName } from "../../src/domain/marketplace-category-name.js";
import type { MarketplaceMetadata } from "../../src/domain/marketplace-metadata.js";
import { MarketplaceType } from "../../src/domain/marketplace-type.js";

export function metadataFixture(overrides: Partial<MarketplaceMetadata> = {}): MarketplaceMetadata {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    listingId: "listing-1",
    packageId: "package-1",
    title: "Test Listing",
    summary: "A test listing",
    description: "A test listing description",
    marketplaceType: MarketplaceType.COMMUNITY,
    category: MarketplaceCategoryName.GENERAL,
    publisherId: "publisher-1",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    keywords: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
