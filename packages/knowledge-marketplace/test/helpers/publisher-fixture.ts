import type { MarketplacePublisher } from "../../src/domain/marketplace-publisher.js";
import { MarketplaceType } from "../../src/domain/marketplace-type.js";

export function publisherFixture(
  overrides: Partial<MarketplacePublisher> = {},
): MarketplacePublisher {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "publisher-1",
    publisherId: "publisher-1",
    name: "Test Publisher",
    marketplaceType: MarketplaceType.COMMUNITY,
    verified: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
