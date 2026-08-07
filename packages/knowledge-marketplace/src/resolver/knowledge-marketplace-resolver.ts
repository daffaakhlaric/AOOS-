import { isBuiltInCategory } from "../domain/built-in-categories.js";
import type { MarketplaceCategoryName } from "../domain/marketplace-category-name.js";
import type { MarketplaceCategory } from "../domain/marketplace-category.js";
import type { MarketplaceCompatibility } from "../domain/marketplace-compatibility.js";
import type { MarketplaceDependency } from "../domain/marketplace-dependency.js";
import type { MarketplacePackage } from "../domain/marketplace-package.js";
import type { MarketplacePublisher } from "../domain/marketplace-publisher.js";
import { MarketplaceCategoryException } from "../errors/marketplace-category-exception.js";
import { MarketplaceNotFoundException } from "../errors/marketplace-not-found-exception.js";
import { KnowledgeMarketplaceRegistryBucket } from "../registry/knowledge-marketplace-registry-bucket.js";
import type { KnowledgeMarketplaceRegistry } from "../registry/knowledge-marketplace-registry.js";
import type { MarketplaceRegistryEntry } from "../registry/marketplace-registry-entry.js";

/**
 * "RESOLVER: Marketplace Resolver, Publisher Resolver, Category Resolver, Compatibility
 * Resolver, Dependency Resolver, Listing Resolver." (docs/PROMPT-005.7J-KNOWLEDGE-
 * MARKETPLACE.md) — the exact 6 resolution dimensions, implemented as 6 method pairs on
 * one class. Every resolve is a direct Registry bucket lookup by id — "Never scan
 * collections" — except `searchListings`/`browseCategory`, the read-only query helpers
 * backing the "Search Metadata"/"Browse Category" Marketplace Operations, which sample
 * `registry.list()` (Metrics/Health-style sampling, not a keyed lookup).
 */
export class KnowledgeMarketplaceResolver {
  constructor(private readonly registry: KnowledgeMarketplaceRegistry) {}

  /* ---- 1. Marketplace Resolver (resolves the underlying MarketplacePackage) ---- */
  resolveMarketplace(packageId: string): MarketplacePackage {
    const entry = this.tryResolveMarketplace(packageId);
    if (!entry) {
      throw new MarketplaceNotFoundException(
        `No Package is registered for Package Id "${packageId}"`,
      );
    }
    return entry;
  }

  tryResolveMarketplace(packageId: string): MarketplacePackage | undefined {
    return this.registry.get<MarketplacePackage>(
      KnowledgeMarketplaceRegistryBucket.PACKAGE,
      packageId,
    );
  }

  /* ---- 2. Publisher Resolver ---- */
  resolvePublisher(publisherId: string): MarketplacePublisher {
    const entry = this.tryResolvePublisher(publisherId);
    if (!entry) {
      throw new MarketplaceNotFoundException(
        `No Publisher is registered for Publisher Id "${publisherId}"`,
      );
    }
    return entry;
  }

  tryResolvePublisher(publisherId: string): MarketplacePublisher | undefined {
    return this.registry.get<MarketplacePublisher>(
      KnowledgeMarketplaceRegistryBucket.PUBLISHER,
      publisherId,
    );
  }

  /* ---- 3. Category Resolver ---- */
  resolveCategory(name: MarketplaceCategoryName): MarketplaceCategory | undefined {
    const registered = this.registry.get<MarketplaceCategory>(
      KnowledgeMarketplaceRegistryBucket.CATEGORY,
      name,
    );
    if (registered) {
      return registered;
    }
    if (isBuiltInCategory(name)) {
      return undefined;
    }
    throw new MarketplaceCategoryException(
      `Category "${name}" is Custom and has no registered MarketplaceCategory record`,
    );
  }

  /* ---- 4. Compatibility Resolver ---- */
  resolveCompatibility(listingId: string): MarketplaceCompatibility {
    const entry = this.tryResolveCompatibility(listingId);
    if (!entry) {
      throw new MarketplaceNotFoundException(
        `No Compatibility record is registered for Listing Id "${listingId}"`,
      );
    }
    return entry;
  }

  tryResolveCompatibility(listingId: string): MarketplaceCompatibility | undefined {
    return this.registry.get<MarketplaceCompatibility>(
      KnowledgeMarketplaceRegistryBucket.COMPATIBILITY,
      listingId,
    );
  }

  /* ---- 5. Dependency Resolver ---- */
  resolveDependency(dependencyId: string): MarketplaceDependency {
    const entry = this.tryResolveDependency(dependencyId);
    if (!entry) {
      throw new MarketplaceNotFoundException(
        `No Dependency is registered for Dependency Id "${dependencyId}"`,
      );
    }
    return entry;
  }

  tryResolveDependency(dependencyId: string): MarketplaceDependency | undefined {
    return this.registry.get<MarketplaceDependency>(
      KnowledgeMarketplaceRegistryBucket.DEPENDENCY,
      dependencyId,
    );
  }

  /* ---- 6. Listing Resolver ---- */
  resolveListing(listingId: string): MarketplaceRegistryEntry {
    const entry = this.tryResolveListing(listingId);
    if (!entry) {
      throw new MarketplaceNotFoundException(
        `No Listing is registered for Listing Id "${listingId}"`,
      );
    }
    return entry;
  }

  tryResolveListing(listingId: string): MarketplaceRegistryEntry | undefined {
    return this.registry.get<MarketplaceRegistryEntry>(
      KnowledgeMarketplaceRegistryBucket.LISTING,
      listingId,
    );
  }

  /* ---- Search Metadata / Browse Category read-only query helpers ---- */
  searchListings(keyword: string): readonly MarketplaceRegistryEntry[] {
    const needle = keyword.trim().toLowerCase();
    if (needle.length === 0) {
      return [];
    }
    return this.registry
      .list<MarketplaceRegistryEntry>(KnowledgeMarketplaceRegistryBucket.LISTING)
      .filter((entry) => {
        const haystack = [
          entry.metadata.title,
          entry.metadata.summary ?? "",
          entry.metadata.description ?? "",
          ...entry.metadata.keywords,
          ...entry.metadata.tags,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      });
  }

  browseCategory(name: MarketplaceCategoryName): readonly MarketplaceRegistryEntry[] {
    return this.registry
      .list<MarketplaceRegistryEntry>(KnowledgeMarketplaceRegistryBucket.LISTING)
      .filter((entry) => entry.metadata.category === name);
  }
}
