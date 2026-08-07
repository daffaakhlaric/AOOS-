import { MarketplaceDependencyKind } from "../../src/domain/marketplace-dependency-kind.js";
import type { MarketplaceDependency } from "../../src/domain/marketplace-dependency.js";

export function dependencyFixture(
  overrides: Partial<MarketplaceDependency> = {},
): MarketplaceDependency {
  return {
    id: "dependency-1",
    listingId: "listing-1",
    dependencyPackageId: "package-2",
    kind: MarketplaceDependencyKind.REQUIRED,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
