/**
 * "EVENTS: MarketplaceCreated, ListingCreated, ListingUpdated, ListingSubmitted,
 * ListingReviewed, ListingCertified, ListingPublished, ListingDeprecated,
 * ListingSuspended, ListingArchived, ListingRemoved." (docs/PROMPT-005.7J-KNOWLEDGE-
 * MARKETPLACE.md) — the exact 11 events.
 */
export enum KnowledgeMarketplaceEventType {
  MARKETPLACE_CREATED = "knowledge.marketplace.created",
  LISTING_CREATED = "knowledge.marketplace.listing.created",
  LISTING_UPDATED = "knowledge.marketplace.listing.updated",
  LISTING_SUBMITTED = "knowledge.marketplace.listing.submitted",
  LISTING_REVIEWED = "knowledge.marketplace.listing.reviewed",
  LISTING_CERTIFIED = "knowledge.marketplace.listing.certified",
  LISTING_PUBLISHED = "knowledge.marketplace.listing.published",
  LISTING_DEPRECATED = "knowledge.marketplace.listing.deprecated",
  LISTING_SUSPENDED = "knowledge.marketplace.listing.suspended",
  LISTING_ARCHIVED = "knowledge.marketplace.listing.archived",
  LISTING_REMOVED = "knowledge.marketplace.listing.removed",
}
