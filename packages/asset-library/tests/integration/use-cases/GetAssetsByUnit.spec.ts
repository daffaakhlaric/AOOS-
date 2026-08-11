import { describe, expect, it } from "vitest";

import { GetAssetsByUnit } from "../../../src/application/use-cases/GetAssetsByUnit.js";
import { AssetBuilder } from "../../../src/builders/AssetBuilder.js";
import { AssetStatus } from "../../../src/domain/value-objects/AssetStatus.js";
import { AssetRepository } from "../../../src/infrastructure/supabase/AssetRepository.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("GetAssetsByUnit (integration)", () => {
  it("returns ACTIVE assets only, sorted newest first", async () => {
    const client = createFakeSupabaseClient();
    const repository = new AssetRepository(client);
    const older = unwrap(
      await repository.insert(
        unwrap(
          new AssetBuilder()
            .withUnitId("unit-1")
            .withCreatedAt(new Date("2026-01-01T00:00:00.000Z"))
            .build(),
        ),
      ),
    );
    const newer = unwrap(
      await repository.insert(
        unwrap(
          new AssetBuilder()
            .withUnitId("unit-1")
            .withCreatedAt(new Date("2026-02-01T00:00:00.000Z"))
            .build(),
        ),
      ),
    );
    const archived = unwrap(
      await repository.insert(
        unwrap(new AssetBuilder().withUnitId("unit-1").withStatus(AssetStatus.ARCHIVED).build()),
      ),
    );

    const getAssetsByUnit = new GetAssetsByUnit(repository);
    const collection = unwrap(await getAssetsByUnit.execute({ unitId: "unit-1" }));

    const ids = collection.assets.map((asset) => asset.id.toString());
    expect(ids).toEqual([newer.id.toString(), older.id.toString()]);
    expect(ids).not.toContain(archived.id.toString());
  });

  it("propagates a repository error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("assets", "boom");
    const repository = new AssetRepository(client);
    const getAssetsByUnit = new GetAssetsByUnit(repository);

    const error = unwrapErr(await getAssetsByUnit.execute({ unitId: "unit-1" }));
    expect(error.message).toContain("boom");
  });
});
