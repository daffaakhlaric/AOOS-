import { MarketplaceCategoryName } from "../../src/domain/marketplace-category-name.js";
import type { MarketplacePackage } from "../../src/domain/marketplace-package.js";
import { MarketplaceType } from "../../src/domain/marketplace-type.js";

export function packageFixture(overrides: Partial<MarketplacePackage> = {}): MarketplacePackage {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "package-1",
    packageId: "package-1",
    name: "Test Package",
    publisherId: "publisher-1",
    marketplaceType: MarketplaceType.COMMUNITY,
    category: MarketplaceCategoryName.GENERAL,
    currentVersion: "1.0.0",
    description: "A test package",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
