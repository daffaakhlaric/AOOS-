/**
 * "MARKETPLACE TYPES: Official, Certified Partner, Community, Private Organization.
 * Metadata only. No authentication." (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md) —
 * the exact 4 marketplace types a `MarketplacePackage`/`MarketplaceListing` may declare.
 */
export enum MarketplaceType {
  OFFICIAL = "official",
  CERTIFIED_PARTNER = "certified_partner",
  COMMUNITY = "community",
  PRIVATE_ORGANIZATION = "private_organization",
}
