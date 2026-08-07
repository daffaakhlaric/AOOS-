import { describe, expect, it } from "vitest";

import { KnowledgeMarketplaceRecord } from "../../src/domain/knowledge-marketplace-record.js";
import { MarketplaceCategoryName } from "../../src/domain/marketplace-category-name.js";
import { MarketplaceCertificationLevel } from "../../src/domain/marketplace-certification-level.js";
import { MarketplaceDependencyKind } from "../../src/domain/marketplace-dependency-kind.js";
import { MarketplacePackageStatus } from "../../src/domain/marketplace-package-status.js";
import { MarketplaceType } from "../../src/domain/marketplace-type.js";
import { MarketplaceNotFoundException } from "../../src/errors/marketplace-not-found-exception.js";
import { KnowledgeMarketplaceEventType } from "../../src/events/knowledge-marketplace-event-type.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { createDraftListing, marketplaceFixture } from "../helpers/marketplace-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("KnowledgeMarketplace facade", () => {
  describe("registerPublisher / registerCategory", () => {
    it("registerPublisher records a Publisher and bumps publisherCount", async () => {
      const { marketplace } = marketplaceFixture();
      const publisher = marketplace.registerPublisher({
        publisherId: "publisher-1",
        name: "Acme",
        marketplaceType: MarketplaceType.OFFICIAL,
      });
      expect(publisher.publisherId).toBe("publisher-1");
      expect(marketplace.metrics.snapshot().publisherCount).toBe(1);
    });

    it("registerCategory records a Custom Category and bumps categoryCount", () => {
      const { marketplace } = marketplaceFixture();
      const category = marketplace.registerCategory({
        name: MarketplaceCategoryName.CUSTOM,
        label: "Custom",
      });
      expect(category.custom).toBe(true);
      expect(marketplace.metrics.snapshot().categoryCount).toBe(1);
    });
  });

  describe("createListing (Operation 1)", () => {
    it("creates a Listing in Draft state and publishes MarketplaceCreated + ListingCreated", async () => {
      const { marketplace, publish } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      const record = marketplace.require(token);

      expect(record.state).toBe(MarketplacePackageStatus.DRAFT);
      expect(record.package.name).toBe("Test Package");
      const types = publish.mock.calls.map((call) => call[0].type);
      expect(types).toContain(KnowledgeMarketplaceEventType.MARKETPLACE_CREATED);
      expect(types).toContain(KnowledgeMarketplaceEventType.LISTING_CREATED);
    });

    it("throws when the underlying validation fails (empty title)", async () => {
      const { marketplace } = marketplaceFixture();
      marketplace.registerPublisher({
        publisherId: "publisher-1",
        name: "Acme",
        marketplaceType: MarketplaceType.COMMUNITY,
      });
      const context = contextFixture({ listingId: "listing-1" });
      await expect(
        marketplace.createListing({
          metadata: metadataFixture({ listingId: "listing-1", title: "" }),
          context,
          packageName: "Test Package",
          currentVersion: "1.0.0",
        }),
      ).rejects.toThrow();
    });
  });

  describe("updateListing (Operation 2)", () => {
    it("updates title/summary/description and publishes ListingUpdated", async () => {
      const { marketplace, publish } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      const record = await marketplace.updateListing({ token, title: "New Title" });
      expect(record.metadata.title).toBe("New Title");
      expect(
        publish.mock.calls.some(
          (call) => call[0].type === KnowledgeMarketplaceEventType.LISTING_UPDATED,
        ),
      ).toBe(true);
    });

    it("throws MarketplaceNotFoundException for an unknown token", async () => {
      const { marketplace } = marketplaceFixture();
      await expect(marketplace.updateListing({ token: "missing" })).rejects.toThrow(
        MarketplaceNotFoundException,
      );
    });
  });

  describe("submit (Operation 3)", () => {
    it("transitions Draft -> Submitted and publishes ListingSubmitted", async () => {
      const { marketplace, publish } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      const record = await marketplace.submit({ token });
      expect(record.state).toBe(MarketplacePackageStatus.SUBMITTED);
      expect(
        publish.mock.calls.some(
          (call) => call[0].type === KnowledgeMarketplaceEventType.LISTING_SUBMITTED,
        ),
      ).toBe(true);
    });
  });

  describe("review (Operation 4)", () => {
    it("transitions Submitted -> Reviewing and publishes ListingReviewed with the decision", async () => {
      const { marketplace, publish } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await marketplace.submit({ token });
      const record = await marketplace.review({ token, reviewedBy: "reviewer-1", approved: true });
      expect(record.state).toBe(MarketplacePackageStatus.REVIEWING);
      const reviewedCall = publish.mock.calls.find(
        (call) => call[0].type === KnowledgeMarketplaceEventType.LISTING_REVIEWED,
      );
      expect(reviewedCall?.[0].payload.approved).toBe(true);
    });
  });

  describe("certify (Operation 5)", () => {
    it("transitions Reviewing -> Certified, records a Certification, and bumps certifiedCount", async () => {
      const { marketplace, publish } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await marketplace.submit({ token });
      await marketplace.review({ token, reviewedBy: "reviewer-1", approved: true });

      const result = await marketplace.certify({
        token,
        certifiedBy: "reviewer-1",
        level: MarketplaceCertificationLevel.STANDARD,
      });

      expect(result.listing.state).toBe(MarketplacePackageStatus.CERTIFIED);
      expect(result.certification.certifiedBy).toBe("reviewer-1");
      expect(marketplace.metrics.snapshot().certifiedCount).toBe(1);
      expect(
        publish.mock.calls.some(
          (call) => call[0].type === KnowledgeMarketplaceEventType.LISTING_CERTIFIED,
        ),
      ).toBe(true);
    });
  });

  describe("publish (Operation 6)", () => {
    it("transitions Certified -> Published, bumps publishedCount, and updates statistics", async () => {
      const { marketplace, publish } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await marketplace.submit({ token });
      await marketplace.review({ token, reviewedBy: "reviewer-1", approved: true });
      await marketplace.certify({
        token,
        certifiedBy: "reviewer-1",
        level: MarketplaceCertificationLevel.BASIC,
      });

      const record = await marketplace.publish({ token });

      expect(record.state).toBe(MarketplacePackageStatus.PUBLISHED);
      expect(marketplace.metrics.snapshot().publishedCount).toBe(1);
      expect(marketplace.statistics.get(MarketplaceCategoryName.GENERAL).publishedCount).toBe(1);
      expect(
        publish.mock.calls.some(
          (call) => call[0].type === KnowledgeMarketplaceEventType.LISTING_PUBLISHED,
        ),
      ).toBe(true);
    });

    it("throws when Publish is attempted without a prior Certification", async () => {
      const { marketplace } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await marketplace.submit({ token });
      await marketplace.review({ token, reviewedBy: "reviewer-1", approved: true });
      // still Reviewing, not Certified -> illegal transition
      await expect(marketplace.publish({ token })).rejects.toThrow();
    });
  });

  async function publishedListing(
    marketplace: Awaited<ReturnType<typeof marketplaceFixture>>["marketplace"],
  ) {
    const token = await createDraftListing(marketplace);
    await marketplace.submit({ token });
    await marketplace.review({ token, reviewedBy: "reviewer-1", approved: true });
    await marketplace.certify({
      token,
      certifiedBy: "reviewer-1",
      level: MarketplaceCertificationLevel.BASIC,
    });
    await marketplace.publish({ token });
    return token;
  }

  describe("deprecate (Operation 7)", () => {
    it("transitions Published -> Deprecated and publishes ListingDeprecated", async () => {
      const { marketplace, publish } = marketplaceFixture();
      const token = await publishedListing(marketplace);
      const record = await marketplace.deprecate({ token, reason: "superseded" });
      expect(record.state).toBe(MarketplacePackageStatus.DEPRECATED);
      expect(
        publish.mock.calls.some(
          (call) => call[0].type === KnowledgeMarketplaceEventType.LISTING_DEPRECATED,
        ),
      ).toBe(true);
    });
  });

  describe("suspend (Operation 8)", () => {
    it("transitions Published -> Suspended and publishes ListingSuspended", async () => {
      const { marketplace, publish } = marketplaceFixture();
      const token = await publishedListing(marketplace);
      const record = await marketplace.suspend({ token, reason: "policy violation" });
      expect(record.state).toBe(MarketplacePackageStatus.SUSPENDED);
      expect(
        publish.mock.calls.some(
          (call) => call[0].type === KnowledgeMarketplaceEventType.LISTING_SUSPENDED,
        ),
      ).toBe(true);
    });

    it("a Suspended Listing can be re-Published", async () => {
      const { marketplace } = marketplaceFixture();
      const token = await publishedListing(marketplace);
      await marketplace.suspend({ token });
      const record = await marketplace.publish({ token });
      expect(record.state).toBe(MarketplacePackageStatus.PUBLISHED);
    });
  });

  describe("archive (Operation 9)", () => {
    it("transitions Published -> Archived and publishes ListingArchived", async () => {
      const { marketplace, publish } = marketplaceFixture();
      const token = await publishedListing(marketplace);
      const record = await marketplace.archive({ token });
      expect(record.state).toBe(MarketplacePackageStatus.ARCHIVED);
      expect(
        publish.mock.calls.some(
          (call) => call[0].type === KnowledgeMarketplaceEventType.LISTING_ARCHIVED,
        ),
      ).toBe(true);
    });
  });

  describe("remove (Operation 10)", () => {
    it("transitions any non-terminal state to Removed (terminal) and publishes ListingRemoved", async () => {
      const { marketplace, publish } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      const record = await marketplace.remove({ token });
      expect(record.state).toBe(MarketplacePackageStatus.REMOVED);
      expect(
        publish.mock.calls.some(
          (call) => call[0].type === KnowledgeMarketplaceEventType.LISTING_REMOVED,
        ),
      ).toBe(true);
    });

    it("Removed is terminal — a further transition throws", async () => {
      const { marketplace } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await marketplace.remove({ token });
      await expect(marketplace.submit({ token })).rejects.toThrow();
    });
  });

  describe("addDependency / removeDependency (Operations 11-12)", () => {
    it("addDependency records a Dependency, bumps dependencyCount, and publishes ListingUpdated", async () => {
      const { marketplace, publish } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await createDraftListing(marketplace, { listingId: "listing-2", packageId: "package-2" });

      const result = await marketplace.addDependency({
        token,
        dependencyPackageId: "package-2",
        kind: MarketplaceDependencyKind.REQUIRED,
      });

      expect(result.dependency.dependencyPackageId).toBe("package-2");
      expect(result.listing.dependencies).toHaveLength(1);
      expect(marketplace.metrics.snapshot().dependencyCount).toBe(1);
      expect(
        publish.mock.calls.some(
          (call) => call[0].type === KnowledgeMarketplaceEventType.LISTING_UPDATED,
        ),
      ).toBe(true);
    });

    it("removeDependency removes a previously added Dependency", async () => {
      const { marketplace } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await createDraftListing(marketplace, { listingId: "listing-2", packageId: "package-2" });
      const added = await marketplace.addDependency({
        token,
        dependencyPackageId: "package-2",
        kind: MarketplaceDependencyKind.OPTIONAL,
      });

      const record = await marketplace.removeDependency({
        token,
        dependencyId: added.dependency.id,
      });
      expect(record.dependencies).toHaveLength(0);
    });
  });

  describe("addCompatibility (Operation 13)", () => {
    it("records a Compatibility record and bumps compatibilityCount", async () => {
      const { marketplace, publish } = marketplaceFixture();
      const token = await createDraftListing(marketplace);

      const result = await marketplace.addCompatibility({
        token,
        aosVersion: "1.2.0",
        requiredKnowledgeVersion: "2.0.0",
        platformCompatibility: ["windows", "linux"],
      });

      expect(result.compatibility.aosVersion).toBe("1.2.0");
      expect(result.listing.compatibility?.platformCompatibility).toEqual(["windows", "linux"]);
      expect(marketplace.metrics.snapshot().compatibilityCount).toBe(1);
      expect(
        publish.mock.calls.some(
          (call) => call[0].type === KnowledgeMarketplaceEventType.LISTING_UPDATED,
        ),
      ).toBe(true);
    });
  });

  describe("updateMetadata (Operation 14)", () => {
    it("updates keywords/tags/category and publishes ListingUpdated", async () => {
      const { marketplace, publish } = marketplaceFixture();
      const token = await createDraftListing(marketplace);

      const record = await marketplace.updateMetadata({
        token,
        keywords: ["automation"],
        tags: ["featured"],
        category: MarketplaceCategoryName.SALES,
      });

      expect(record.metadata.keywords).toEqual(["automation"]);
      expect(record.metadata.tags).toEqual(["featured"]);
      expect(record.metadata.category).toBe(MarketplaceCategoryName.SALES);
      expect(
        publish.mock.calls.some(
          (call) => call[0].type === KnowledgeMarketplaceEventType.LISTING_UPDATED,
        ),
      ).toBe(true);
    });

    it("leaves keywords/tags/category unchanged when no fields are supplied", async () => {
      const { marketplace } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      const before = marketplace.require(token);

      const record = await marketplace.updateMetadata({ token });

      expect(record.metadata.keywords).toEqual(before.metadata.keywords);
      expect(record.metadata.tags).toEqual(before.metadata.tags);
      expect(record.metadata.category).toBe(before.metadata.category);
      expect(record.package.category).toBe(before.package.category);
    });
  });

  describe("searchMetadata (Operation 15, read-only)", () => {
    it("finds listings by keyword and bumps searchCount without a state change", async () => {
      const { marketplace } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await marketplace.updateListing({ token, title: "Sales Forecasting Assistant" });

      const result = marketplace.searchMetadata({ keyword: "forecasting" });

      expect(result.listings).toHaveLength(1);
      expect(result.listings[0]).toBeInstanceOf(KnowledgeMarketplaceRecord);
      expect(marketplace.metrics.snapshot().searchCount).toBe(1);
      expect(marketplace.require(token).state).toBe(MarketplacePackageStatus.DRAFT);
    });
  });

  describe("browseCategory (Operation 16, read-only)", () => {
    it("finds listings by category and bumps browseCount", async () => {
      const { marketplace } = marketplaceFixture();
      await createDraftListing(marketplace);

      const result = marketplace.browseCategory({ category: MarketplaceCategoryName.GENERAL });

      expect(result.listings).toHaveLength(1);
      expect(marketplace.metrics.snapshot().browseCount).toBe(1);
    });

    it("returns empty for a category with no listings", () => {
      const { marketplace } = marketplaceFixture();
      const result = marketplace.browseCategory({ category: MarketplaceCategoryName.BANKING });
      expect(result.listings).toHaveLength(0);
    });
  });

  describe("use / get / require / list / count", () => {
    it("use registers middleware invoked on every pipeline run", async () => {
      const { marketplace } = marketplaceFixture();
      const calls: string[] = [];
      marketplace.use((_execution, next) => {
        calls.push("middleware-ran");
        return next();
      });
      await createDraftListing(marketplace);
      expect(calls).toContain("middleware-ran");
    });

    it("use returns this for chaining", () => {
      const { marketplace } = marketplaceFixture();
      expect(marketplace.use(() => undefined)).toBe(marketplace);
    });

    it("get returns undefined for an unknown token", () => {
      const { marketplace } = marketplaceFixture();
      expect(marketplace.get("missing")).toBeUndefined();
    });

    it("get returns a KnowledgeMarketplaceRecord for a known token", async () => {
      const { marketplace } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      expect(marketplace.get(token)?.token).toBe(token);
    });

    it("require throws MarketplaceNotFoundException for an unknown token", () => {
      const { marketplace } = marketplaceFixture();
      expect(() => marketplace.require("missing")).toThrow(MarketplaceNotFoundException);
    });

    it("list/count reflect registered Listings", async () => {
      const { marketplace } = marketplaceFixture();
      expect(marketplace.count()).toBe(0);
      await createDraftListing(marketplace);
      expect(marketplace.count()).toBe(1);
      expect(marketplace.list()).toHaveLength(1);
    });
  });

  describe("illegal transitions are rejected end-to-end", () => {
    it("certify throws when the Listing is still Draft (not Reviewing)", async () => {
      const { marketplace } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await expect(
        marketplace.certify({
          token,
          certifiedBy: "r-1",
          level: MarketplaceCertificationLevel.BASIC,
        }),
      ).rejects.toThrow();
    });

    it("deprecate throws when the Listing was never Published", async () => {
      const { marketplace } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await expect(marketplace.deprecate({ token })).rejects.toThrow();
    });

    it("suspend throws when the Listing was never Published", async () => {
      const { marketplace } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await expect(marketplace.suspend({ token })).rejects.toThrow();
    });

    it("archive throws from Draft (Draft cannot Archive directly)", async () => {
      const { marketplace } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await expect(marketplace.archive({ token })).rejects.toThrow();
    });

    it("review throws when the Listing is still Draft (Submit must run first)", async () => {
      const { marketplace } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await expect(
        marketplace.review({ token, reviewedBy: "r-1", approved: true }),
      ).rejects.toThrow();
    });
  });

  describe("archive is reachable from every settled predecessor", () => {
    it("archives a Deprecated Listing", async () => {
      const { marketplace } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await marketplace.submit({ token });
      await marketplace.review({ token, reviewedBy: "r-1", approved: true });
      await marketplace.certify({
        token,
        certifiedBy: "r-1",
        level: MarketplaceCertificationLevel.BASIC,
      });
      await marketplace.publish({ token });
      await marketplace.deprecate({ token });
      const record = await marketplace.archive({ token });
      expect(record.state).toBe(MarketplacePackageStatus.ARCHIVED);
    });

    it("archives a Suspended Listing", async () => {
      const { marketplace } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await marketplace.submit({ token });
      await marketplace.review({ token, reviewedBy: "r-1", approved: true });
      await marketplace.certify({
        token,
        certifiedBy: "r-1",
        level: MarketplaceCertificationLevel.BASIC,
      });
      await marketplace.publish({ token });
      await marketplace.suspend({ token });
      const record = await marketplace.archive({ token });
      expect(record.state).toBe(MarketplacePackageStatus.ARCHIVED);
    });
  });

  describe("addCompatibility called twice replaces the prior record", () => {
    it("keeps exactly one Compatibility record per Listing", async () => {
      const { marketplace } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await marketplace.addCompatibility({
        token,
        aosVersion: "1.0.0",
        requiredKnowledgeVersion: "1.0.0",
      });
      const second = await marketplace.addCompatibility({
        token,
        aosVersion: "2.0.0",
        requiredKnowledgeVersion: "2.0.0",
      });
      expect(second.listing.compatibility?.aosVersion).toBe("2.0.0");
      expect(marketplace.metrics.snapshot().compatibilityCount).toBe(2);
    });
  });

  describe("registerPublisher duplicate rejection", () => {
    it("throws when registering the same publisherId twice", () => {
      const { marketplace } = marketplaceFixture();
      marketplace.registerPublisher({
        publisherId: "dup-1",
        name: "Acme",
        marketplaceType: MarketplaceType.OFFICIAL,
      });
      expect(() =>
        marketplace.registerPublisher({
          publisherId: "dup-1",
          name: "Acme Again",
          marketplaceType: MarketplaceType.OFFICIAL,
        }),
      ).toThrow();
    });
  });

  describe("multi-listing statistics and metrics aggregation", () => {
    it("tracks listedCount/publishedCount independently per category", async () => {
      const { marketplace } = marketplaceFixture();
      const tokenA = await createDraftListing(marketplace, {
        listingId: "listing-a",
        packageId: "package-a",
      });
      await createDraftListing(marketplace, { listingId: "listing-b", packageId: "package-b" });

      await marketplace.submit({ token: tokenA });
      await marketplace.review({ token: tokenA, reviewedBy: "r-1", approved: true });
      await marketplace.certify({
        token: tokenA,
        certifiedBy: "r-1",
        level: MarketplaceCertificationLevel.BASIC,
      });
      await marketplace.publish({ token: tokenA });

      expect(marketplace.statistics.get(MarketplaceCategoryName.GENERAL).listedCount).toBe(2);
      expect(marketplace.statistics.get(MarketplaceCategoryName.GENERAL).publishedCount).toBe(1);
      expect(marketplace.metrics.snapshot().packageCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("event payload coverage for every Listing lifecycle event", () => {
    it("publishes exactly one event per lifecycle-transition operation", async () => {
      const { marketplace, publish } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      publish.mockClear();

      await marketplace.submit({ token });
      await marketplace.review({ token, reviewedBy: "r-1", approved: true });
      await marketplace.certify({
        token,
        certifiedBy: "r-1",
        level: MarketplaceCertificationLevel.BASIC,
      });
      await marketplace.publish({ token });
      await marketplace.deprecate({ token });

      const types = publish.mock.calls.map((call) => call[0].type);
      expect(types).toEqual([
        KnowledgeMarketplaceEventType.LISTING_SUBMITTED,
        KnowledgeMarketplaceEventType.LISTING_REVIEWED,
        KnowledgeMarketplaceEventType.LISTING_CERTIFIED,
        KnowledgeMarketplaceEventType.LISTING_PUBLISHED,
        KnowledgeMarketplaceEventType.LISTING_DEPRECATED,
      ]);
    });

    it("remove from Published publishes ListingRemoved", async () => {
      const { marketplace, publish } = marketplaceFixture();
      const token = await createDraftListing(marketplace);
      await marketplace.submit({ token });
      await marketplace.review({ token, reviewedBy: "r-1", approved: true });
      await marketplace.certify({
        token,
        certifiedBy: "r-1",
        level: MarketplaceCertificationLevel.BASIC,
      });
      await marketplace.publish({ token });
      publish.mockClear();

      await marketplace.remove({ token });

      expect(
        publish.mock.calls.some(
          (call) => call[0].type === KnowledgeMarketplaceEventType.LISTING_REMOVED,
        ),
      ).toBe(true);
    });
  });

  describe("createListing rejects a mismatched context/metadata listingId", () => {
    it("throws when metadata.listingId does not match context.listingId", async () => {
      const { marketplace } = marketplaceFixture();
      marketplace.registerPublisher({
        publisherId: "publisher-1",
        name: "Acme",
        marketplaceType: MarketplaceType.COMMUNITY,
      });
      await expect(
        marketplace.createListing({
          metadata: metadataFixture({ listingId: "listing-1" }),
          context: contextFixture({ listingId: "other-listing" }),
          packageName: "Test Package",
          currentVersion: "1.0.0",
        }),
      ).rejects.toThrow();
    });
  });
});
