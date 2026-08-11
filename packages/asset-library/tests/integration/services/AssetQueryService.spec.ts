import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { AssetQueryService } from "../../../src/application/services/AssetQueryService.js";
import { GetAsset } from "../../../src/application/use-cases/GetAsset.js";
import { GetAssetsByBranch } from "../../../src/application/use-cases/GetAssetsByBranch.js";
import { GetAssetsByType } from "../../../src/application/use-cases/GetAssetsByType.js";
import { GetAssetsByUnit } from "../../../src/application/use-cases/GetAssetsByUnit.js";
import { GetBrandAssets } from "../../../src/application/use-cases/GetBrandAssets.js";
import { AssetBuilder } from "../../../src/builders/AssetBuilder.js";
import { AssetType } from "../../../src/domain/value-objects/AssetType.js";
import { AssetRepository } from "../../../src/infrastructure/supabase/AssetRepository.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

function makeQueryService() {
  const repository = new AssetRepository(createFakeSupabaseClient());
  const service = new AssetQueryService(
    new GetAsset(repository),
    new GetAssetsByUnit(repository),
    new GetAssetsByBranch(repository),
    new GetAssetsByType(repository),
    new GetBrandAssets(repository),
  );
  return { service, repository };
}

describe("AssetQueryService (integration facade)", () => {
  it("byId() delegates to GetAsset", async () => {
    const { service, repository } = makeQueryService();
    const inserted = unwrap(await repository.insert(unwrap(new AssetBuilder().build())));
    const found = unwrap(await service.byId(inserted.id.toString()));
    expect(found.id.equals(inserted.id)).toBe(true);
  });

  it("byUnit() delegates to GetAssetsByUnit", async () => {
    const { service, repository } = makeQueryService();
    await repository.insert(unwrap(new AssetBuilder().withUnitId("unit-1").build()));
    const collection = unwrap(await service.byUnit("unit-1"));
    expect(collection.count).toBe(1);
  });

  it("byBranch() delegates to GetAssetsByBranch", async () => {
    const { service, repository } = makeQueryService();
    await repository.insert(unwrap(new AssetBuilder().withBranch(Branch.BANDUNG).build()));
    const collection = unwrap(await service.byBranch(Branch.BANDUNG));
    expect(collection.count).toBe(1);
  });

  it("byType() delegates to GetAssetsByType", async () => {
    const { service, repository } = makeQueryService();
    await repository.insert(unwrap(new AssetBuilder().withType(AssetType.OVERLAY).build()));
    const collection = unwrap(await service.byType(AssetType.OVERLAY));
    expect(collection.count).toBe(1);
  });

  it("brandAssets() delegates to GetBrandAssets", async () => {
    const { service, repository } = makeQueryService();
    await repository.insert(unwrap(new AssetBuilder().withType(AssetType.BRAND).build()));
    const collection = unwrap(await service.brandAssets());
    expect(collection.count).toBe(1);
  });
});
