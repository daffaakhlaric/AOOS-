import { MarketplaceCategoryName } from "./marketplace-category-name.js";

/** One catalog entry describing a built-in `MarketplaceCategoryName` — metadata only. */
export interface BuiltInCategoryDefinition {
  readonly name: MarketplaceCategoryName;
  readonly label: string;
  readonly description: string;
}

/**
 * The 15 non-`Custom` built-in Category definitions — always resolvable without a
 * registered `MarketplaceCategory` record. `Custom` is deliberately excluded: it is the
 * one category that requires an explicit registration (see `MarketplaceCategoryName`).
 */
export const BUILT_IN_CATEGORY_DEFINITIONS: readonly BuiltInCategoryDefinition[] = [
  {
    name: MarketplaceCategoryName.GENERAL,
    label: "General",
    description: "General-purpose Knowledge Assets.",
  },
  {
    name: MarketplaceCategoryName.MARKETING,
    label: "Marketing",
    description: "Marketing Knowledge Assets.",
  },
  { name: MarketplaceCategoryName.SALES, label: "Sales", description: "Sales Knowledge Assets." },
  {
    name: MarketplaceCategoryName.HR,
    label: "HR",
    description: "Human Resources Knowledge Assets.",
  },
  {
    name: MarketplaceCategoryName.FINANCE,
    label: "Finance",
    description: "Finance Knowledge Assets.",
  },
  {
    name: MarketplaceCategoryName.CUSTOMER_SERVICE,
    label: "Customer Service",
    description: "Customer Service Knowledge Assets.",
  },
  {
    name: MarketplaceCategoryName.PROPERTY,
    label: "Property",
    description: "Property Knowledge Assets.",
  },
  {
    name: MarketplaceCategoryName.HEALTHCARE,
    label: "Healthcare",
    description: "Healthcare Knowledge Assets.",
  },
  {
    name: MarketplaceCategoryName.EDUCATION,
    label: "Education",
    description: "Education Knowledge Assets.",
  },
  {
    name: MarketplaceCategoryName.MANUFACTURING,
    label: "Manufacturing",
    description: "Manufacturing Knowledge Assets.",
  },
  {
    name: MarketplaceCategoryName.AUTOMOTIVE,
    label: "Automotive",
    description: "Automotive Knowledge Assets.",
  },
  {
    name: MarketplaceCategoryName.BANKING,
    label: "Banking",
    description: "Banking Knowledge Assets.",
  },
  {
    name: MarketplaceCategoryName.INSURANCE,
    label: "Insurance",
    description: "Insurance Knowledge Assets.",
  },
  {
    name: MarketplaceCategoryName.GOVERNMENT,
    label: "Government",
    description: "Government Knowledge Assets.",
  },
  {
    name: MarketplaceCategoryName.SOFTWARE_ENGINEERING,
    label: "Software Engineering",
    description: "Software Engineering Knowledge Assets.",
  },
];

const BUILT_IN_CATEGORY_NAMES: ReadonlySet<MarketplaceCategoryName> = new Set(
  BUILT_IN_CATEGORY_DEFINITIONS.map((definition) => definition.name),
);

/** True for any built-in category other than `Custom` — those always resolve. */
export function isBuiltInCategory(name: MarketplaceCategoryName): boolean {
  return BUILT_IN_CATEGORY_NAMES.has(name);
}
