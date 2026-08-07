/**
 * "CATEGORIES: Support built-in categories: General, Marketing, Sales, HR, Finance,
 * Customer Service, Property, Healthcare, Education, Manufacturing, Automotive, Banking,
 * Insurance, Government, Software Engineering, Custom." (docs/PROMPT-005.7J-KNOWLEDGE-
 * MARKETPLACE.md) — the exact 16 built-in category names. `CUSTOM` is the only value
 * that requires a matching `MarketplaceCategory` record to be registered in the
 * `KnowledgeMarketplaceRegistryBucket.CATEGORY` bucket before a Listing may declare it —
 * every other value always resolves (see `built-in-categories.ts`).
 */
export enum MarketplaceCategoryName {
  GENERAL = "general",
  MARKETING = "marketing",
  SALES = "sales",
  HR = "hr",
  FINANCE = "finance",
  CUSTOMER_SERVICE = "customer_service",
  PROPERTY = "property",
  HEALTHCARE = "healthcare",
  EDUCATION = "education",
  MANUFACTURING = "manufacturing",
  AUTOMOTIVE = "automotive",
  BANKING = "banking",
  INSURANCE = "insurance",
  GOVERNMENT = "government",
  SOFTWARE_ENGINEERING = "software_engineering",
  CUSTOM = "custom",
}
