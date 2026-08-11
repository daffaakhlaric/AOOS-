import { describe, expect, it } from "vitest";

import { GetBrandAssets } from "../../../src/application/use-cases/GetBrandAssets.js";
import { AssetBuilder } from "../../../src/builders/AssetBuilder.js";
import { AssetStatus } from "../../../src/domain/value-objects/AssetStatus.js";
import { AssetType } from "../../../src/domain/value-objects/AssetType.js";
import { AssetRepository } from "../../../src/infrastructure/supabase/AssetRepository.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("GetBrandAssets (integration)", () => {
  it("returns type=BRAND assets only, ACTIVE only", async () => {
    const client = createFakeSupabaseClient();
    const repository = new AssetRepository(client);
    const activeBrand = unwrap(
      await repository.insert(
        unwrap(new AssetBuilder().withType(AssetType.BRAND).withStatus(AssetStatus.ACTIVE).build()),
      ),
    );
    await repository.insert(
      unwrap(new AssetBuilder().withType(AssetType.BRAND).withStatus(AssetStatus.ARCHIVED).build()),
    );
    await repository.insert(unwrap(new AssetBuilder().withType(AssetType.UNIT_PHOTO).build()));

    const getBrandAssets = new GetBrandAssets(repository);
    const collection = unwrap(await getBrandAssets.execute());

    expect(collection.assets.map((a) => a.id.toString())).toEqual([activeBrand.id.toString()]);
  });

  it("propagates a repository error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("assets", "boom");
    const repository = new AssetRepository(client);
    const getBrandAssets = new GetBrandAssets(repository);

    const error = unwrapErr(await getBrandAssets.execute());
    expect(error.message).toContain("boom");
  });
});
