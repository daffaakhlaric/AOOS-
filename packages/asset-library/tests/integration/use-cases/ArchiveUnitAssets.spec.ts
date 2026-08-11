import { describe, expect, it } from "vitest";

import { ArchiveUnitAssets } from "../../../src/application/use-cases/ArchiveUnitAssets.js";
import { GetAssetsByUnit } from "../../../src/application/use-cases/GetAssetsByUnit.js";
import { AssetBuilder } from "../../../src/builders/AssetBuilder.js";
import { AssetLibraryEvents } from "../../../src/domain/events/AssetLibraryEvents.js";
import { AssetStatus } from "../../../src/domain/value-objects/AssetStatus.js";
import { AssetRepository } from "../../../src/infrastructure/supabase/AssetRepository.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { createStubAssetRepository, err, AssetError } from "../../helpers/repository.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

function makeArchiveUnitAssets() {
  const client = createFakeSupabaseClient();
  const repository = new AssetRepository(client);
  const publisher = createFakePublisher();
  const events = new AssetLibraryEvents(publisher);
  const archiveUnitAssets = new ArchiveUnitAssets(
    repository,
    events,
    () => new Date("2026-03-01T00:00:00.000Z"),
  );
  return { archiveUnitAssets, repository, publisher };
}

describe("ArchiveUnitAssets (integration)", () => {
  it("unit sold -> all photos ARCHIVED", async () => {
    const { archiveUnitAssets, repository } = makeArchiveUnitAssets();
    await repository.insert(unwrap(new AssetBuilder().withUnitId("unit-1").build()));
    await repository.insert(unwrap(new AssetBuilder().withUnitId("unit-1").build()));
    await repository.insert(unwrap(new AssetBuilder().withUnitId("unit-2").build()));

    unwrap(
      await archiveUnitAssets.execute({
        unitId: "unit-1",
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );

    const unit1Assets = unwrap(await repository.findByUnitId("unit-1"));
    expect(unit1Assets.every((asset) => asset.status === AssetStatus.ARCHIVED)).toBe(true);
    const unit2Assets = unwrap(await repository.findByUnitId("unit-2"));
    expect(unit2Assets[0]?.status).toBe(AssetStatus.ACTIVE);
  });

  it("ARCHIVED assets are not returned in ACTIVE queries after archiving", async () => {
    const { archiveUnitAssets, repository } = makeArchiveUnitAssets();
    await repository.insert(unwrap(new AssetBuilder().withUnitId("unit-1").build()));
    const getAssetsByUnit = new GetAssetsByUnit(repository);

    unwrap(
      await archiveUnitAssets.execute({
        unitId: "unit-1",
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );

    const active = unwrap(await getAssetsByUnit.execute({ unitId: "unit-1" }));
    expect(active.isEmpty()).toBe(true);
  });

  it("emits one AssetArchived event per archived asset", async () => {
    const { archiveUnitAssets, repository, publisher } = makeArchiveUnitAssets();
    await repository.insert(unwrap(new AssetBuilder().withUnitId("unit-1").build()));
    await repository.insert(unwrap(new AssetBuilder().withUnitId("unit-1").build()));

    unwrap(
      await archiveUnitAssets.execute({
        unitId: "unit-1",
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );

    expect(publisher.published).toHaveLength(2);
    expect(publisher.published.every((p) => p.type === "aaos.assets.archived")).toBe(true);
  });

  it("no assets for the unit -> succeeds with no events", async () => {
    const { archiveUnitAssets, publisher } = makeArchiveUnitAssets();
    unwrap(
      await archiveUnitAssets.execute({
        unitId: "unit-none",
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(publisher.published).toHaveLength(0);
  });

  it("propagates a findByUnitId repository error", async () => {
    const publisher = createFakePublisher();
    const events = new AssetLibraryEvents(publisher);
    const failingRepository = createStubAssetRepository({
      findByUnitId: async () => err(new AssetError("find failed")),
    });
    const archiveUnitAssets = new ArchiveUnitAssets(failingRepository, events);

    const error = unwrapErr(
      await archiveUnitAssets.execute({
        unitId: "unit-1",
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.message).toContain("find failed");
  });

  it("propagates an update repository error mid-loop", async () => {
    const { repository } = makeArchiveUnitAssets();
    await repository.insert(unwrap(new AssetBuilder().withUnitId("unit-1").build()));
    const publisher = createFakePublisher();
    const events = new AssetLibraryEvents(publisher);
    const failingRepository = createStubAssetRepository({
      findByUnitId: async () => repository.findByUnitId("unit-1"),
      update: async () => err(new AssetError("update failed")),
    });
    const archiveUnitAssets = new ArchiveUnitAssets(failingRepository, events);

    const error = unwrapErr(
      await archiveUnitAssets.execute({
        unitId: "unit-1",
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.message).toContain("update failed");
  });
});
