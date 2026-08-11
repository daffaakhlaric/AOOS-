import { EventCategory } from "@aos/event-bus";
import { describe, expect, it } from "vitest";

import { AssetLibraryEvents } from "../../../src/domain/events/AssetLibraryEvents.js";
import { createFakePublisher } from "../../helpers/publisher.js";

describe("AssetLibraryEvents", () => {
  it("publishAssetUploaded() publishes aaos.assets.uploaded", async () => {
    const publisher = createFakePublisher();
    const events = new AssetLibraryEvents(publisher);
    await events.publishAssetUploaded({
      assetId: "asset-1",
      assetType: "UNIT_PHOTO",
      unitId: "unit-1",
      branch: "BINTARO",
      storagePath: "units/unit-1/photo-1.jpg",
      publicUrl: "https://example.com/photo.jpg",
      tenantId: "dss-motor",
      correlationId: "corr-1",
      occurredAt: new Date(),
      version: "1.0",
    });
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.type).toBe("aaos.assets.uploaded");
    expect(publisher.published[0]?.category).toBe(EventCategory.DOMAIN);
    expect(publisher.published[0]?.producer).toBe("@aos/asset-library");
    expect(publisher.published[0]?.tenantId).toBe("dss-motor");
    expect(publisher.published[0]?.correlationId).toBe("corr-1");
  });

  it("publishAssetArchived() publishes aaos.assets.archived", async () => {
    const publisher = createFakePublisher();
    const events = new AssetLibraryEvents(publisher);
    await events.publishAssetArchived({
      assetId: "asset-1",
      unitId: "unit-1",
      tenantId: "dss-motor",
      correlationId: "corr-1",
      occurredAt: new Date(),
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.assets.archived");
  });

  it("publishAssetTagged() publishes aaos.assets.tagged", async () => {
    const publisher = createFakePublisher();
    const events = new AssetLibraryEvents(publisher);
    await events.publishAssetTagged({
      assetId: "asset-1",
      tags: ["branch:BINTARO"],
      tenantId: "dss-motor",
      correlationId: "corr-1",
      occurredAt: new Date(),
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.assets.tagged");
  });

  it("publishCollectionUpdated() publishes aaos.assets.collection.updated", async () => {
    const publisher = createFakePublisher();
    const events = new AssetLibraryEvents(publisher);
    await events.publishCollectionUpdated({
      assetIds: ["asset-1", "asset-2"],
      creativeBriefId: "brief-1",
      tenantId: "dss-motor",
      correlationId: "corr-1",
      occurredAt: new Date(),
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.assets.collection.updated");
  });

  it("uses a custom source when provided", async () => {
    const publisher = createFakePublisher();
    const events = new AssetLibraryEvents(publisher, "custom-source");
    await events.publishAssetTagged({
      assetId: "asset-1",
      tags: [],
      tenantId: "dss-motor",
      correlationId: "corr-1",
      occurredAt: new Date(),
      version: "1.0",
    });
    expect(publisher.published[0]?.source).toBe("custom-source");
  });
});
