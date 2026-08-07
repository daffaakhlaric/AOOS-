import type { IPublisher } from "@aos/event-bus";
import type { vi } from "vitest";

import { MarketplaceCategoryName } from "../../src/domain/marketplace-category-name.js";
import { MarketplaceType } from "../../src/domain/marketplace-type.js";
import { KnowledgeMarketplace } from "../../src/marketplace/knowledge-marketplace.js";

import { contextFixture } from "./context-fixture.js";
import { fakePublisher } from "./event-publisher-fixture.js";
import { metadataFixture } from "./metadata-fixture.js";

export function marketplaceFixture(): {
  marketplace: KnowledgeMarketplace;
  publisher: IPublisher;
  publish: ReturnType<typeof vi.fn>;
} {
  const { publisher, publish } = fakePublisher();
  return { marketplace: new KnowledgeMarketplace(publisher), publisher, publish };
}

/** Registers a Publisher and creates a Draft Listing, returning its token for further operations. */
export async function createDraftListing(
  marketplace: KnowledgeMarketplace,
  overrides: {
    readonly listingId?: string;
    readonly packageId?: string;
    readonly publisherId?: string;
  } = {},
): Promise<string> {
  const listingId = overrides.listingId ?? "listing-1";
  const packageId = overrides.packageId ?? "package-1";
  const publisherId = overrides.publisherId ?? `publisher-for-${listingId}`;

  try {
    marketplace.registerPublisher({
      publisherId,
      name: "Test Publisher",
      marketplaceType: MarketplaceType.COMMUNITY,
    });
  } catch {
    /* Publisher already registered by a prior call sharing the same publisherId — reuse it. */
  }

  const context = contextFixture({ listingId });
  const record = await marketplace.createListing({
    metadata: metadataFixture({
      listingId,
      packageId,
      publisherId,
      category: MarketplaceCategoryName.GENERAL,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
    }),
    context,
    packageName: "Test Package",
    currentVersion: "1.0.0",
  });

  return record.token;
}
