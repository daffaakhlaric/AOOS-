import { describe, expect, it } from "vitest";

import { MarketplaceCategoryName } from "../../src/domain/marketplace-category-name.js";
import { MarketplacePackageStatus } from "../../src/domain/marketplace-package-status.js";
import { MarketplaceType } from "../../src/domain/marketplace-type.js";
import { KnowledgeMarketplaceFactory } from "../../src/factory/knowledge-marketplace-factory.js";

describe("KnowledgeMarketplaceFactory", () => {
  const factory = new KnowledgeMarketplaceFactory();

  it("package.create builds a MarketplacePackage keyed by packageId", () => {
    const pkg = factory.package.create({
      packageId: "package-1",
      name: "Test Package",
      publisherId: "publisher-1",
      marketplaceType: MarketplaceType.COMMUNITY,
      category: MarketplaceCategoryName.GENERAL,
      currentVersion: "1.0.0",
    });
    expect(pkg.id).toBe("package-1");
    expect(pkg.packageId).toBe("package-1");
  });

  it("listing.create builds a MarketplaceListing in Draft state", () => {
    const listing = factory.listing.create({
      token: "kmkt_1",
      listingId: "listing-1",
      packageId: "package-1",
      tenantId: "tenant-1",
    });
    expect(listing.state).toBe(MarketplacePackageStatus.DRAFT);
    expect(listing.token).toBe("kmkt_1");
  });

  it("publisher.create builds a MarketplacePublisher keyed by publisherId", () => {
    const publisher = factory.publisher.create({
      publisherId: "publisher-1",
      name: "Test Publisher",
      marketplaceType: MarketplaceType.OFFICIAL,
    });
    expect(publisher.id).toBe("publisher-1");
    expect(publisher.verified).toBe(false);
  });

  it("publisher.create honors an explicit verified flag", () => {
    const publisher = factory.publisher.create({
      publisherId: "publisher-1",
      name: "Test Publisher",
      marketplaceType: MarketplaceType.OFFICIAL,
      verified: true,
    });
    expect(publisher.verified).toBe(true);
  });

  it("category.create builds a MarketplaceCategory defaulting custom to true", () => {
    const category = factory.category.create({
      name: MarketplaceCategoryName.CUSTOM,
      label: "Custom",
    });
    expect(category.custom).toBe(true);
  });

  it("category.create honors an explicit custom flag", () => {
    const category = factory.category.create({
      name: MarketplaceCategoryName.GENERAL,
      label: "General",
      custom: false,
    });
    expect(category.custom).toBe(false);
  });

  it("compatibility.create builds a MarketplaceCompatibility with default empty arrays", () => {
    const compatibility = factory.compatibility.create({
      listingId: "listing-1",
      aosVersion: "1.0.0",
      requiredKnowledgeVersion: "1.0.0",
    });
    expect(compatibility.requiredPackages).toEqual([]);
    expect(compatibility.platformCompatibility).toEqual([]);
  });

  it("compatibility.create carries through supplied arrays", () => {
    const compatibility = factory.compatibility.create({
      listingId: "listing-1",
      aosVersion: "1.0.0",
      requiredKnowledgeVersion: "1.0.0",
      requiredPackages: ["package-2"],
      platformCompatibility: ["windows"],
    });
    expect(compatibility.requiredPackages).toEqual(["package-2"]);
    expect(compatibility.platformCompatibility).toEqual(["windows"]);
  });

  it("metadata.create builds a MarketplaceMetadata with default empty keywords/tags", () => {
    const metadata = factory.metadata.create({
      listingId: "listing-1",
      packageId: "package-1",
      title: "Test Listing",
      marketplaceType: MarketplaceType.COMMUNITY,
      category: MarketplaceCategoryName.GENERAL,
      publisherId: "publisher-1",
      tenantId: "tenant-1",
    });
    expect(metadata.keywords).toEqual([]);
    expect(metadata.tags).toEqual([]);
  });

  it("metadata.create carries through createdBy as updatedBy", () => {
    const metadata = factory.metadata.create({
      listingId: "listing-1",
      packageId: "package-1",
      title: "Test Listing",
      marketplaceType: MarketplaceType.COMMUNITY,
      category: MarketplaceCategoryName.GENERAL,
      publisherId: "publisher-1",
      tenantId: "tenant-1",
      createdBy: "user-1",
    });
    expect(metadata.createdBy).toBe("user-1");
    expect(metadata.updatedBy).toBe("user-1");
  });
});
