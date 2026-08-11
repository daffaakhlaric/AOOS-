import { describe, expect, it } from "vitest";

import { ArchiveAsset } from "../../../src/application/use-cases/ArchiveAsset.js";
import { AssetBuilder } from "../../../src/builders/AssetBuilder.js";
import { AssetLibraryEvents } from "../../../src/domain/events/AssetLibraryEvents.js";
import { AssetStatus } from "../../../src/domain/value-objects/AssetStatus.js";
import { AssetRepository } from "../../../src/infrastructure/supabase/AssetRepository.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { AssetError, createStubAssetRepository, err } from "../../helpers/repository.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

function makeArchiveAsset() {
  const client = createFakeSupabaseClient();
  const repository = new AssetRepository(client);
  const publisher = createFakePublisher();
  const events = new AssetLibraryEvents(publisher);
  const archiveAsset = new ArchiveAsset(
    repository,
    events,
    () => new Date("2026-03-01T00:00:00.000Z"),
  );
  return { archiveAsset, repository, publisher };
}

describe("ArchiveAsset (integration)", () => {
  it("marks the asset ARCHIVED without deleting it", async () => {
    const { archiveAsset, repository } = makeArchiveAsset();
    const inserted = unwrap(
      await repository.insert(unwrap(new AssetBuilder().withUnitId("unit-1").build())),
    );

    const archived = unwrap(
      await archiveAsset.execute({
        id: inserted.id.toString(),
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(archived.status).toBe(AssetStatus.ARCHIVED);

    const stillThere = unwrap(await repository.findById(inserted.id));
    expect(stillThere).toBeDefined();
  });

  it("emits AssetArchived", async () => {
    const { archiveAsset, repository, publisher } = makeArchiveAsset();
    const inserted = unwrap(await repository.insert(unwrap(new AssetBuilder().build())));

    await archiveAsset.execute({
      id: inserted.id.toString(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.type).toBe("aaos.assets.archived");
  });

  it("returns AssetNotFoundError for an invalid id", async () => {
    const { archiveAsset } = makeArchiveAsset();
    const error = unwrapErr(
      await archiveAsset.execute({ id: "", tenantId: "dss-motor", correlationId: "corr-1" }),
    );
    expect(error.name).toBe("AssetNotFoundError");
  });

  it("returns AssetNotFoundError when no row matches", async () => {
    const { archiveAsset } = makeArchiveAsset();
    const error = unwrapErr(
      await archiveAsset.execute({
        id: "00000000-0000-0000-0000-000000000000",
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
    const archiveAsset = new ArchiveAsset(failingRepository, events);

    const error = unwrapErr(
      await archiveAsset.execute({ id: "some-id", tenantId: "dss-motor", correlationId: "corr-1" }),
    );
    expect(error.message).toContain("find failed");
  });

  it("propagates an update repository error", async () => {
    const client = createFakeSupabaseClient();
    const repository = new AssetRepository(client);
    const publisher = createFakePublisher();
    const events = new AssetLibraryEvents(publisher);
    const archiveAsset = new ArchiveAsset(repository, events);
    const inserted = unwrap(await repository.insert(unwrap(new AssetBuilder().build())));
    // skip: 1 lets the use case's own findById() select succeed first; the error lands on the
    // very next "assets" operation, which is the update() this test targets.
    client.forceErrorOnce("assets", "update failed", 1);

    const error = unwrapErr(
      await archiveAsset.execute({
        id: inserted.id.toString(),
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.message).toContain("update failed");
  });
});
