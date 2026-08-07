import type { MarketplaceCompatibility } from "../../src/domain/marketplace-compatibility.js";

export function compatibilityFixture(
  overrides: Partial<MarketplaceCompatibility> = {},
): MarketplaceCompatibility {
  return {
    id: "listing-1",
    listingId: "listing-1",
    aosVersion: "1.0.0",
    requiredPackages: [],
    optionalPackages: [],
    requiredKnowledgeVersion: "1.0.0",
    runtimeCompatibility: [],
    platformCompatibility: [],
    recordedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
