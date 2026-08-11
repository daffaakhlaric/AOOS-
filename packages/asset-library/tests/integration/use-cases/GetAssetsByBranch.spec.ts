import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { GetAssetsByBranch } from "../../../src/application/use-cases/GetAssetsByBranch.js";
import { AssetBuilder } from "../../../src/builders/AssetBuilder.js";
import { AssetRepository } from "../../../src/infrastructure/supabase/AssetRepository.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("GetAssetsByBranch (integration)", () => {
  it("returns only assets for the given branch", async () => {
    const client = createFakeSupabaseClient();
    const repository = new AssetRepository(client);
    const bintaro = unwrap(
      await repository.insert(unwrap(new AssetBuilder().withBranch(Branch.BINTARO).build())),
    );
    await repository.insert(unwrap(new AssetBuilder().withBranch(Branch.CINERE).build()));

    const getAssetsByBranch = new GetAssetsByBranch(repository);
    const collection = unwrap(await getAssetsByBranch.execute({ branch: Branch.BINTARO }));

    expect(collection.assets.map((a) => a.id.toString())).toEqual([bintaro.id.toString()]);
  });

  it("propagates a repository error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("assets", "boom");
    const repository = new AssetRepository(client);
    const getAssetsByBranch = new GetAssetsByBranch(repository);

    const error = unwrapErr(await getAssetsByBranch.execute({ branch: Branch.BINTARO }));
    expect(error.message).toContain("boom");
  });
});
