import { describe, expect, it } from "vitest";

import {
  BUILT_IN_CATEGORY_DEFINITIONS,
  isBuiltInCategory,
} from "../../src/domain/built-in-categories.js";
import { marketplaceAuditEntrySchema } from "../../src/domain/marketplace-audit.js";
import { MarketplaceCategoryName } from "../../src/domain/marketplace-category-name.js";
import { marketplaceCategorySchema } from "../../src/domain/marketplace-category.js";
import { MarketplaceCertificationLevel } from "../../src/domain/marketplace-certification-level.js";
import { marketplaceCertificationSchema } from "../../src/domain/marketplace-certification.js";
import { marketplaceCompatibilitySchema } from "../../src/domain/marketplace-compatibility.js";
import { MarketplaceDependencyKind } from "../../src/domain/marketplace-dependency-kind.js";
import { marketplaceDependencySchema } from "../../src/domain/marketplace-dependency.js";
import { marketplaceInstallationMetadataSchema } from "../../src/domain/marketplace-installation-metadata.js";
import { marketplaceListingSchema } from "../../src/domain/marketplace-listing.js";
import { marketplaceLogEntrySchema } from "../../src/domain/marketplace-log.js";
import { marketplaceMetadataSchema } from "../../src/domain/marketplace-metadata.js";
import {
  MARKETPLACE_SETTLED_STATES,
  MARKETPLACE_STATE_TRANSITIONS,
  MARKETPLACE_TERMINAL_STATES,
  MarketplacePackageStatus,
} from "../../src/domain/marketplace-package-status.js";
import { marketplacePackageSchema } from "../../src/domain/marketplace-package.js";
import { marketplacePublisherSchema } from "../../src/domain/marketplace-publisher.js";
import {
  EMPTY_MARKETPLACE_STATISTICS,
  marketplaceStatisticsSnapshotSchema,
} from "../../src/domain/marketplace-statistics-snapshot.js";
import { marketplaceTagSchema } from "../../src/domain/marketplace-tag.js";
import { marketplaceTraceSchema } from "../../src/domain/marketplace-trace.js";
import { MarketplaceType } from "../../src/domain/marketplace-type.js";
import { marketplaceVersionSchema } from "../../src/domain/marketplace-version.js";
import { certificationFixture } from "../helpers/certification-fixture.js";
import { compatibilityFixture } from "../helpers/compatibility-fixture.js";
import { dependencyFixture } from "../helpers/dependency-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";
import { packageFixture } from "../helpers/package-fixture.js";
import { publisherFixture } from "../helpers/publisher-fixture.js";

describe("domain", () => {
  it("MarketplaceType has exactly 4 values", () => {
    expect(Object.values(MarketplaceType)).toHaveLength(4);
  });

  it("MarketplaceCategoryName has exactly 16 values", () => {
    expect(Object.values(MarketplaceCategoryName)).toHaveLength(16);
  });

  it("MarketplacePackageStatus has exactly 9 values", () => {
    expect(Object.values(MarketplacePackageStatus)).toHaveLength(9);
  });

  it("MarketplaceDependencyKind has exactly 4 values", () => {
    expect(Object.values(MarketplaceDependencyKind)).toHaveLength(4);
  });

  it("BUILT_IN_CATEGORY_DEFINITIONS has exactly 15 entries (Custom excluded)", () => {
    expect(BUILT_IN_CATEGORY_DEFINITIONS).toHaveLength(15);
  });

  it("isBuiltInCategory is true for General", () => {
    expect(isBuiltInCategory(MarketplaceCategoryName.GENERAL)).toBe(true);
  });

  it("isBuiltInCategory is false for Custom", () => {
    expect(isBuiltInCategory(MarketplaceCategoryName.CUSTOM)).toBe(false);
  });

  it("Removed is the sole terminal state", () => {
    expect(MARKETPLACE_TERMINAL_STATES.has(MarketplacePackageStatus.REMOVED)).toBe(true);
    expect(MARKETPLACE_TERMINAL_STATES.size).toBe(1);
  });

  it("Removed has no outgoing transitions", () => {
    expect(MARKETPLACE_STATE_TRANSITIONS[MarketplacePackageStatus.REMOVED]).toHaveLength(0);
  });

  it("every non-terminal state can transition to Removed", () => {
    for (const state of Object.values(MarketplacePackageStatus)) {
      if (state === MarketplacePackageStatus.REMOVED) {
        continue;
      }
      expect(MARKETPLACE_STATE_TRANSITIONS[state]).toContain(MarketplacePackageStatus.REMOVED);
    }
  });

  it("settled states include Deprecated, Suspended, Archived, Removed", () => {
    expect(MARKETPLACE_SETTLED_STATES.has(MarketplacePackageStatus.DEPRECATED)).toBe(true);
    expect(MARKETPLACE_SETTLED_STATES.has(MarketplacePackageStatus.SUSPENDED)).toBe(true);
    expect(MARKETPLACE_SETTLED_STATES.has(MarketplacePackageStatus.ARCHIVED)).toBe(true);
    expect(MARKETPLACE_SETTLED_STATES.has(MarketplacePackageStatus.REMOVED)).toBe(true);
  });

  it("marketplacePackageSchema parses a valid package", () => {
    expect(() => marketplacePackageSchema.parse(packageFixture())).not.toThrow();
  });

  it("marketplaceListingSchema parses a valid listing", () => {
    const listing = {
      id: "id-1",
      token: "kmkt_00000000-0000-4000-8000-000000000000",
      listingId: "listing-1",
      packageId: "package-1",
      tenantId: "tenant-1",
      state: MarketplacePackageStatus.DRAFT,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(() => marketplaceListingSchema.parse(listing)).not.toThrow();
  });

  it("marketplacePublisherSchema parses a valid publisher", () => {
    expect(() => marketplacePublisherSchema.parse(publisherFixture())).not.toThrow();
  });

  it("marketplaceCategorySchema parses a valid category", () => {
    const category = {
      id: "id-1",
      name: MarketplaceCategoryName.CUSTOM,
      label: "Custom Label",
      custom: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    expect(() => marketplaceCategorySchema.parse(category)).not.toThrow();
  });

  it("marketplaceTagSchema parses a valid tag", () => {
    expect(() =>
      marketplaceTagSchema.parse({ id: "t-1", listingId: "l-1", name: "tag" }),
    ).not.toThrow();
  });

  it("marketplaceCertificationSchema parses a valid certification", () => {
    expect(() => marketplaceCertificationSchema.parse(certificationFixture())).not.toThrow();
  });

  it("MarketplaceCertificationLevel has exactly 3 values", () => {
    expect(Object.values(MarketplaceCertificationLevel)).toHaveLength(3);
  });

  it("marketplaceCompatibilitySchema parses a valid compatibility record", () => {
    expect(() => marketplaceCompatibilitySchema.parse(compatibilityFixture())).not.toThrow();
  });

  it("marketplaceDependencySchema parses a valid dependency", () => {
    expect(() => marketplaceDependencySchema.parse(dependencyFixture())).not.toThrow();
  });

  it("marketplaceVersionSchema parses a valid version", () => {
    const version = {
      id: "v-1",
      packageId: "package-1",
      version: "1.0.0",
      releasedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(() => marketplaceVersionSchema.parse(version)).not.toThrow();
  });

  it("marketplaceStatisticsSnapshotSchema parses EMPTY_MARKETPLACE_STATISTICS", () => {
    expect(() =>
      marketplaceStatisticsSnapshotSchema.parse(EMPTY_MARKETPLACE_STATISTICS),
    ).not.toThrow();
  });

  it("EMPTY_MARKETPLACE_STATISTICS has zeroed counts", () => {
    expect(EMPTY_MARKETPLACE_STATISTICS.listedCount).toBe(0);
    expect(EMPTY_MARKETPLACE_STATISTICS.publishedCount).toBe(0);
  });

  it("marketplaceMetadataSchema parses a valid metadata record", () => {
    expect(() => marketplaceMetadataSchema.parse(metadataFixture())).not.toThrow();
  });

  it("marketplaceInstallationMetadataSchema parses a valid installation metadata record", () => {
    const installation = {
      id: "i-1",
      listingId: "listing-1",
      instructions: "Follow the README.",
      requirements: ["Node 20+"],
      recordedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(() => marketplaceInstallationMetadataSchema.parse(installation)).not.toThrow();
  });

  it("marketplaceAuditEntrySchema parses a valid audit entry", () => {
    const audit = {
      id: "a-1",
      operation: "create_listing",
      listingId: "listing-1",
      tenantId: "tenant-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
    };
    expect(() => marketplaceAuditEntrySchema.parse(audit)).not.toThrow();
  });

  it("marketplaceLogEntrySchema parses a valid log entry", () => {
    const log = {
      sequence: 0,
      level: "info",
      operation: "create_listing",
      message: "done",
      occurredAt: "2026-01-01T00:00:00.000Z",
    };
    expect(() => marketplaceLogEntrySchema.parse(log)).not.toThrow();
  });

  it("marketplaceTraceSchema parses a valid trace", () => {
    const trace = {
      traceId: "trace-1",
      correlationId: "corr-1",
      operation: "create_listing",
      tracedAt: "2026-01-01T00:00:00.000Z",
      runCount: 1,
    };
    expect(() => marketplaceTraceSchema.parse(trace)).not.toThrow();
  });

  it("marketplaceMetadataSchema rejects an empty title", () => {
    expect(() => marketplaceMetadataSchema.parse(metadataFixture({ title: "" }))).toThrow();
  });

  it("marketplacePackageSchema rejects an empty currentVersion", () => {
    expect(() => marketplacePackageSchema.parse(packageFixture({ currentVersion: "" }))).toThrow();
  });

  it.each(Object.values(MarketplaceCategoryName))(
    "%s is a registerable MarketplaceCategoryName value",
    (name) => {
      expect(() =>
        marketplaceCategorySchema.parse({
          id: name,
          name,
          label: name,
          custom: name === MarketplaceCategoryName.CUSTOM,
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
      ).not.toThrow();
    },
  );

  it.each(Object.values(MarketplaceDependencyKind))(
    "%s is a valid MarketplaceDependencyKind",
    (kind) => {
      expect(() => marketplaceDependencySchema.parse(dependencyFixture({ kind }))).not.toThrow();
    },
  );

  it.each(Object.values(MarketplaceCertificationLevel))(
    "%s is a valid MarketplaceCertificationLevel",
    (level) => {
      expect(() =>
        marketplaceCertificationSchema.parse(certificationFixture({ level })),
      ).not.toThrow();
    },
  );

  it.each(Object.values(MarketplaceType))("%s is a valid MarketplaceType", (marketplaceType) => {
    expect(() => marketplacePackageSchema.parse(packageFixture({ marketplaceType }))).not.toThrow();
  });
});
