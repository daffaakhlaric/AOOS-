import { describe, expect, it } from "vitest";

import { TagAsset } from "../../../src/application/use-cases/TagAsset.js";
import { AssetBuilder } from "../../../src/builders/AssetBuilder.js";
import { AssetLibraryEvents } from "../../../src/domain/events/AssetLibraryEvents.js";
import { AssetRepository } from "../../../src/infrastructure/supabase/AssetRepository.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { AssetError, createStubAssetRepository, err } from "../../helpers/repository.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

function makeTagAsset() {
  const client = createFakeSupabaseClient();
  const repository = new AssetRepository(client);
  const publisher = createFakePublisher();
  const events = new AssetLibraryEvents(publisher);
  const tagAsset = new TagAsset(repository, events, () => new Date("2026-03-01T00:00:00.000Z"));
  return { tagAsset, repository, publisher };
}

describe("TagAsset (integration)", () => {
  it("adds tags to an existing asset", async () => {
    const { tagAsset, repository } = makeTagAsset();
    const inserted = unwrap(
      await repository.insert(unwrap(new AssetBuilder().withTags([]).build())),
    );

    const tagged = unwrap(
      await tagAsset.execute({
        id: inserted.id.toString(),
        tags: ["angle:front", "condition:mint"],
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(tagged.tags.map((t) => t.toString())).toEqual(["angle:front", "condition:mint"]);
  });

  it("merges with existing tags without duplicating", async () => {
    const { tagAsset, repository } = makeTagAsset();
    const inserted = unwrap(
      await repository.insert(unwrap(new AssetBuilder().withTags(["angle:front"]).build())),
    );

    const tagged = unwrap(
      await tagAsset.execute({
        id: inserted.id.toString(),
        tags: ["angle:front", "angle:rear"],
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(tagged.tags.map((t) => t.toString())).toEqual(["angle:front", "angle:rear"]);
  });

  it("emits AssetTagged", async () => {
    const { tagAsset, repository, publisher } = makeTagAsset();
    const inserted = unwrap(await repository.insert(unwrap(new AssetBuilder().build())));

    await tagAsset.execute({
      id: inserted.id.toString(),
      tags: ["angle:front"],
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(publisher.published[0]?.type).toBe("aaos.assets.tagged");
  });

  it("rejects an empty tags array via Zod validation", async () => {
    const { tagAsset, repository } = makeTagAsset();
    const inserted = unwrap(await repository.insert(unwrap(new AssetBuilder().build())));

    const error = unwrapErr(
      await tagAsset.execute({
        id: inserted.id.toString(),
        tags: [],
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.message).toContain("TagAsset input validation failed");
  });

  it("returns AssetNotFoundError when no row matches", async () => {
    const { tagAsset } = makeTagAsset();
    const error = unwrapErr(
      await tagAsset.execute({
        id: "00000000-0000-0000-0000-000000000000",
        tags: ["a"],
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.name).toBe("AssetNotFoundError");
  });

  it("propagates a findById repository error", async () => {
    const publisher = createFakePublisher();
    const events = new AssetLibraryEvents(publisher);
    const failingRepository = createStubAssetRepository({
      findById: async () => err(new AssetError("find failed")),
    });
    const tagAsset = new TagAsset(failingRepository, events);

    const error = unwrapErr(
      await tagAsset.execute({
        id: "some-id",
        tags: ["a"],
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.message).toContain("find failed");
  });

  it("propagates an update repository error", async () => {
    const { repository } = makeTagAsset();
    const inserted = unwrap(await repository.insert(unwrap(new AssetBuilder().build())));
    const publisher = createFakePublisher();
    const events = new AssetLibraryEvents(publisher);
    const failingRepository = createStubAssetRepository({
      findById: async () => repository.findById(inserted.id),
      update: async () => err(new AssetError("update failed")),
    });
    const tagAsset = new TagAsset(failingRepository, events);

    const error = unwrapErr(
      await tagAsset.execute({
        id: inserted.id.toString(),
        tags: ["a"],
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.message).toContain("update failed");
  });
});
