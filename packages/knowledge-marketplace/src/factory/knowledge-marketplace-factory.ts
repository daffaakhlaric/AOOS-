import type { MarketplaceCategoryName } from "../domain/marketplace-category-name.js";
import type { MarketplaceCategory } from "../domain/marketplace-category.js";
import type { MarketplaceCompatibility } from "../domain/marketplace-compatibility.js";
import type { MarketplaceListing } from "../domain/marketplace-listing.js";
import type { MarketplaceMetadata } from "../domain/marketplace-metadata.js";
import { MarketplacePackageStatus } from "../domain/marketplace-package-status.js";
import type { MarketplacePackage } from "../domain/marketplace-package.js";
import type { MarketplacePublisher } from "../domain/marketplace-publisher.js";
import type { MarketplaceType } from "../domain/marketplace-type.js";
import { generateId } from "../utils/id.js";

/** "MarketplaceFactory" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Factory") — creates `MarketplacePackage` records. */
class MarketplaceFactory {
  create(input: {
    packageId: string;
    name: string;
    publisherId: string;
    marketplaceType: MarketplaceType;
    category: MarketplaceCategoryName;
    currentVersion: string;
    description?: string;
  }): MarketplacePackage {
    const now = new Date().toISOString();
    return {
      /* Registry bucket key = packageId — "Registry: Token-based only. Never scan
       * collections." requires PACKAGE bucket entries to be looked up by packageId. */
      id: input.packageId,
      packageId: input.packageId,
      name: input.name,
      publisherId: input.publisherId,
      marketplaceType: input.marketplaceType,
      category: input.category,
      currentVersion: input.currentVersion,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/** "ListingFactory" — creates `MarketplaceListing` instance envelopes. */
class ListingFactory {
  create(input: {
    token: string;
    listingId: string;
    packageId: string;
    tenantId: string;
    workspaceId?: string;
  }): MarketplaceListing {
    const now = new Date().toISOString();
    return {
      id: generateId(),
      token: input.token,
      listingId: input.listingId,
      packageId: input.packageId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      state: MarketplacePackageStatus.DRAFT,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/** "PublisherFactory" — creates `MarketplacePublisher` records. */
class PublisherFactory {
  create(input: {
    publisherId: string;
    name: string;
    marketplaceType: MarketplaceType;
    verified?: boolean;
    contactEmail?: string;
  }): MarketplacePublisher {
    const now = new Date().toISOString();
    return {
      /* Registry bucket key = publisherId, matching the PACKAGE bucket convention. */
      id: input.publisherId,
      publisherId: input.publisherId,
      name: input.name,
      marketplaceType: input.marketplaceType,
      verified: input.verified ?? false,
      contactEmail: input.contactEmail,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/** "CategoryFactory" — creates `MarketplaceCategory` records (needed only for `Custom` categories). */
class CategoryFactory {
  create(input: {
    name: MarketplaceCategoryName;
    label: string;
    description?: string;
    custom?: boolean;
  }): MarketplaceCategory {
    return {
      id: generateId(),
      name: input.name,
      label: input.label,
      description: input.description,
      custom: input.custom ?? true,
      createdAt: new Date().toISOString(),
    };
  }
}

/** "CompatibilityFactory" — creates `MarketplaceCompatibility` records. */
class CompatibilityFactory {
  create(input: {
    listingId: string;
    aosVersion: string;
    requiredKnowledgeVersion: string;
    requiredPackages?: readonly string[];
    optionalPackages?: readonly string[];
    runtimeCompatibility?: readonly string[];
    platformCompatibility?: readonly string[];
  }): MarketplaceCompatibility {
    return {
      id: generateId(),
      listingId: input.listingId,
      aosVersion: input.aosVersion,
      requiredPackages: [...(input.requiredPackages ?? [])],
      optionalPackages: [...(input.optionalPackages ?? [])],
      requiredKnowledgeVersion: input.requiredKnowledgeVersion,
      runtimeCompatibility: [...(input.runtimeCompatibility ?? [])],
      platformCompatibility: [...(input.platformCompatibility ?? [])],
      recordedAt: new Date().toISOString(),
    };
  }
}

/** "MetadataFactory" — creates `MarketplaceMetadata` records. */
class MetadataFactory {
  create(input: {
    listingId: string;
    packageId: string;
    title: string;
    marketplaceType: MarketplaceType;
    category: MarketplaceCategoryName;
    publisherId: string;
    tenantId: string;
    summary?: string;
    description?: string;
    workspaceId?: string;
    keywords?: readonly string[];
    tags?: readonly string[];
    createdBy?: string;
  }): MarketplaceMetadata {
    const now = new Date().toISOString();
    return {
      listingId: input.listingId,
      packageId: input.packageId,
      title: input.title,
      summary: input.summary,
      description: input.description,
      marketplaceType: input.marketplaceType,
      category: input.category,
      publisherId: input.publisherId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      keywords: [...(input.keywords ?? [])],
      tags: [...(input.tags ?? [])],
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/**
 * "FACTORY: Implement: MarketplaceFactory, ListingFactory, PublisherFactory,
 * CategoryFactory, CompatibilityFactory, MetadataFactory."
 * (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md) — "KnowledgeMarketplaceFactory"
 * composes the 6 named sub-factories as `readonly` fields.
 */
export class KnowledgeMarketplaceFactory {
  readonly package = new MarketplaceFactory();
  readonly listing = new ListingFactory();
  readonly publisher = new PublisherFactory();
  readonly category = new CategoryFactory();
  readonly compatibility = new CompatibilityFactory();
  readonly metadata = new MetadataFactory();
}
