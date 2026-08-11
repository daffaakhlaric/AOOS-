import { describe, expect, it } from "vitest";

import { GetAssetsByType } from "../../../src/application/use-cases/GetAssetsByType.js";
import { AssetBuilder } from "../../../src/builders/AssetBuilder.js";
import { AssetType } from "../../../src/domain/value-objects/AssetType.js";
import { AssetRepository } from "../../../src/infrastructure/supabase/AssetRepository.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("GetAssetsByType (integration)", () => {
  it("returns only assets of the given type", async () => {
    const client = createFakeSupabaseClient();
    const repository = new AssetRepository(client);
    const brand = unwrap(
      await repository.insert(unwrap(new AssetBuilder().withType(AssetType.BRAND).build())),
    );
    await repository.insert(unwrap(new AssetBuilder().withType(AssetType.UNIT_PHOTO).build()));

    const getAssetsByType = new GetAssetsByType(repository);
    const collection = unwrap(await getAssetsByType.execute({ type: AssetType.BRAND }));

    expect(collection.assets.map((a) => a.id.toString())).toEqual([brand.id.toString()]);
  });

  it("propagates a repository error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("assets", "boom");
    const repository = new AssetRepository(client);
    const getAssetsByType = new GetAssetsByType(repository);

    const error = unwrapErr(await getAssetsByType.execute({ type: AssetType.BRAND }));
    expect(error.message).toContain("boom");
  });
});
