import { MarketplaceCertificationLevel } from "../../src/domain/marketplace-certification-level.js";
import type { MarketplaceCertification } from "../../src/domain/marketplace-certification.js";

export function certificationFixture(
  overrides: Partial<MarketplaceCertification> = {},
): MarketplaceCertification {
  return {
    id: "certification-1",
    listingId: "listing-1",
    level: MarketplaceCertificationLevel.STANDARD,
    certifiedBy: "reviewer-1",
    certifiedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
