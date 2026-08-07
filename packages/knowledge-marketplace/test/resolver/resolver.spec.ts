import { beforeEach, describe, expect, it } from "vitest";

import { MarketplaceCategoryName } from "../../src/domain/marketplace-category-name.js";
import { MarketplaceCategoryException } from "../../src/errors/marketplace-category-exception.js";
import { MarketplaceNotFoundException } from "../../src/errors/marketplace-not-found-exception.js";
import { KnowledgeMarketplaceRegistryBucket } from "../../src/registry/knowledge-marketplace-registry-bucket.js";
import { KnowledgeMarketplaceRegistry } from "../../src/registry/knowledge-marketplace-registry.js";
import type { MarketplaceRegistryEntry } from "../../src/registry/marketplace-registry-entry.js";
import { KnowledgeMarketplaceResolver } from "../../src/resolver/knowledge-marketplace-resolver.js";
import { compatibilityFixture } from "../helpers/compatibility-fixture.js";
import { dependencyFixture } from "../helpers/dependency-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";
import { packageFixture } from "../helpers/package-fixture.js";
import { publisherFixture } from "../helpers/publisher-fixture.js";

describe("KnowledgeMarketplaceResolver", () => {
  let registry: KnowledgeMarketplaceRegistry;
  let resolver: KnowledgeMarketplaceResolver;

  beforeEach(() => {
    registry = new KnowledgeMarketplaceRegistry();
    resolver = new KnowledgeMarketplaceResolver(registry);
  });

  it("resolveMarketplace resolves a registered Package", () => {
    const pkg = packageFixture();
    registry.register(KnowledgeMarketplaceRegistryBucket.PACKAGE, pkg);
    expect(resolver.resolveMarketplace(pkg.packageId)).toEqual(pkg);
  });

  it("resolveMarketplace throws for an unregistered Package", () => {
    expect(() => resolver.resolveMarketplace("missing")).toThrow(MarketplaceNotFoundException);
  });

  it("tryResolveMarketplace returns undefined for an unregistered Package", () => {
    expect(resolver.tryResolveMarketplace("missing")).toBeUndefined();
  });

  it("resolvePublisher resolves a registered Publisher", () => {
    const publisher = publisherFixture();
    registry.register(KnowledgeMarketplaceRegistryBucket.PUBLISHER, publisher);
    expect(resolver.resolvePublisher(publisher.publisherId)).toEqual(publisher);
  });

  it("resolvePublisher throws for an unregistered Publisher", () => {
    expect(() => resolver.resolvePublisher("missing")).toThrow(MarketplaceNotFoundException);
  });

  it("tryResolvePublisher returns undefined for an unregistered Publisher", () => {
    expect(resolver.tryResolvePublisher("missing")).toBeUndefined();
  });

  it("resolveCategory returns undefined for a built-in category with no registered record", () => {
    expect(resolver.resolveCategory(MarketplaceCategoryName.GENERAL)).toBeUndefined();
  });

  it("resolveCategory throws MarketplaceCategoryException for an unregistered Custom category", () => {
    expect(() => resolver.resolveCategory(MarketplaceCategoryName.CUSTOM)).toThrow(
      MarketplaceCategoryException,
    );
  });

  it("resolveCategory returns the registered record for a registered Custom category", () => {
    const category = {
      id: MarketplaceCategoryName.CUSTOM,
      name: MarketplaceCategoryName.CUSTOM,
      label: "Custom",
      custom: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    registry.register(KnowledgeMarketplaceRegistryBucket.CATEGORY, category);
    expect(resolver.resolveCategory(MarketplaceCategoryName.CUSTOM)).toEqual(category);
  });

  it("resolveCompatibility resolves a registered Compatibility record", () => {
    const compatibility = compatibilityFixture();
    registry.register(KnowledgeMarketplaceRegistryBucket.COMPATIBILITY, compatibility);
    expect(resolver.resolveCompatibility(compatibility.listingId)).toEqual(compatibility);
  });

  it("resolveCompatibility throws for an unregistered Compatibility record", () => {
    expect(() => resolver.resolveCompatibility("missing")).toThrow(MarketplaceNotFoundException);
  });

  it("tryResolveCompatibility returns undefined for an unregistered record", () => {
    expect(resolver.tryResolveCompatibility("missing")).toBeUndefined();
  });

  it("resolveDependency resolves a registered Dependency", () => {
    const dependency = dependencyFixture();
    registry.register(KnowledgeMarketplaceRegistryBucket.DEPENDENCY, dependency);
    expect(resolver.resolveDependency(dependency.id)).toEqual(dependency);
  });

  it("resolveDependency throws for an unregistered Dependency", () => {
    expect(() => resolver.resolveDependency("missing")).toThrow(MarketplaceNotFoundException);
  });

  it("tryResolveDependency returns undefined for an unregistered Dependency", () => {
    expect(resolver.tryResolveDependency("missing")).toBeUndefined();
  });

  it("resolveListing resolves a registered Listing entry", () => {
    const entry: MarketplaceRegistryEntry = {
      id: "listing-1",
      token: "kmkt_1",
      metadata: metadataFixture(),
    };
    registry.register(KnowledgeMarketplaceRegistryBucket.LISTING, entry);
    expect(resolver.resolveListing("listing-1")).toEqual(entry);
  });

  it("resolveListing throws for an unregistered Listing", () => {
    expect(() => resolver.resolveListing("missing")).toThrow(MarketplaceNotFoundException);
  });

  it("tryResolveListing returns undefined for an unregistered Listing", () => {
    expect(resolver.tryResolveListing("missing")).toBeUndefined();
  });

  it("searchListings matches by title", () => {
    const entry: MarketplaceRegistryEntry = {
      id: "listing-1",
      token: "kmkt_1",
      metadata: metadataFixture({ title: "Sales Assistant" }),
    };
    registry.register(KnowledgeMarketplaceRegistryBucket.LISTING, entry);
    expect(resolver.searchListings("sales")).toHaveLength(1);
  });

  it("searchListings matches by keyword", () => {
    const entry: MarketplaceRegistryEntry = {
      id: "listing-1",
      token: "kmkt_1",
      metadata: metadataFixture({ keywords: ["automation"] }),
    };
    registry.register(KnowledgeMarketplaceRegistryBucket.LISTING, entry);
    expect(resolver.searchListings("automation")).toHaveLength(1);
  });

  it("searchListings returns empty for a blank keyword", () => {
    expect(resolver.searchListings("   ")).toHaveLength(0);
  });

  it("searchListings returns empty when nothing matches", () => {
    const entry: MarketplaceRegistryEntry = {
      id: "listing-1",
      token: "kmkt_1",
      metadata: metadataFixture(),
    };
    registry.register(KnowledgeMarketplaceRegistryBucket.LISTING, entry);
    expect(resolver.searchListings("nonexistent-xyz")).toHaveLength(0);
  });

  it("searchListings matches title even when summary/description are absent", () => {
    const entry: MarketplaceRegistryEntry = {
      id: "listing-1",
      token: "kmkt_1",
      metadata: metadataFixture({
        title: "Bare Listing",
        summary: undefined,
        description: undefined,
      }),
    };
    registry.register(KnowledgeMarketplaceRegistryBucket.LISTING, entry);
    expect(resolver.searchListings("bare")).toHaveLength(1);
  });

  it("browseCategory returns listings in the given category", () => {
    const entry: MarketplaceRegistryEntry = {
      id: "listing-1",
      token: "kmkt_1",
      metadata: metadataFixture({ category: MarketplaceCategoryName.FINANCE }),
    };
    registry.register(KnowledgeMarketplaceRegistryBucket.LISTING, entry);
    expect(resolver.browseCategory(MarketplaceCategoryName.FINANCE)).toHaveLength(1);
    expect(resolver.browseCategory(MarketplaceCategoryName.HR)).toHaveLength(0);
  });
});
