import { describe, expect, it } from "vitest";

import { GetAsset } from "../../../src/application/use-cases/GetAsset.js";
import { AssetBuilder } from "../../../src/builders/AssetBuilder.js";
import { AssetRepository } from "../../../src/infrastructure/supabase/AssetRepository.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("GetAsset (integration)", () => {
  it("returns the asset when found", async () => {
    const client = createFakeSupabaseClient();
    const repository = new AssetRepository(client);
    const asset = unwrap(await repository.insert(unwrap(new AssetBuilder().build())));
    const getAsset = new GetAsset(repository);

    const found = unwrap(await getAsset.execute(asset.id.toString()));
    expect(found.id.equals(asset.id)).toBe(true);
  });

  it("returns AssetNotFoundError when no row matches", async () => {
    const client = createFakeSupabaseClient();
    const repository = new AssetRepository(client);
    const getAsset = new GetAsset(repository);

    const error = unwrapErr(await getAsset.execute("00000000-0000-0000-0000-000000000000"));
    expect(error.name).toBe("AssetNotFoundError");
  });

  it("returns AssetNotFoundError for an invalid id", async () => {
    const client = createFakeSupabaseClient();
    const repository = new AssetRepository(client);
    const getAsset = new GetAsset(repository);

    const error = unwrapErr(await getAsset.execute(""));
    expect(error.name).toBe("AssetNotFoundError");
  });

  it("propagates a repository error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("assets", "boom");
    const repository = new AssetRepository(client);
    const getAsset = new GetAsset(repository);

    const error = unwrapErr(await getAsset.execute("some-id"));
    expect(error.message).toContain("boom");
  });
});
