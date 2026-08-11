import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { AssetBuilder } from "../../../src/builders/AssetBuilder.js";
import { AssetStatus } from "../../../src/domain/value-objects/AssetStatus.js";
import { AssetType } from "../../../src/domain/value-objects/AssetType.js";
import { AssetMapper } from "../../../src/infrastructure/mappers/AssetMapper.js";
import { AssetRepository } from "../../../src/infrastructure/supabase/AssetRepository.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("AssetRepository", () => {
  it("insert() persists a row and returns the mapped Asset", async () => {
    const client = createFakeSupabaseClient();
    const repo = new AssetRepository(client);
    const asset = unwrap(new AssetBuilder().build());

    const inserted = unwrap(await repo.insert(asset));
    expect(inserted.id.equals(asset.id)).toBe(true);
    expect(client.rows("assets")).toHaveLength(1);
  });

  it("insert() surfaces a 'no row returned' error", async () => {
    const client = createFakeSupabaseClient();
    client.forceNullOnce("assets");
    const repo = new AssetRepository(client);
    const asset = unwrap(new AssetBuilder().build());

    const error = unwrapErr(await repo.insert(asset));
    expect(error.message).toContain("no row returned");
  });

  it("insert() surfaces a Postgrest error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("assets", "insert failed");
    const repo = new AssetRepository(client);
    const asset = unwrap(new AssetBuilder().build());

    const error = unwrapErr(await repo.insert(asset));
    expect(error.message).toContain("AssetRepository.insert failed");
  });

  it("findById() returns undefined when no row matches", async () => {
    const client = createFakeSupabaseClient();
    const repo = new AssetRepository(client);
    const asset = unwrap(new AssetBuilder().build());

    const found = unwrap(await repo.findById(asset.id));
    expect(found).toBeUndefined();
  });

  it("findById() returns the mapped Asset when a row matches", async () => {
    const client = createFakeSupabaseClient();
    const repo = new AssetRepository(client);
    const asset = unwrap(new AssetBuilder().build());
    await repo.insert(asset);

    const found = unwrap(await repo.findById(asset.id));
    expect(found?.id.equals(asset.id)).toBe(true);
  });

  it("findById() surfaces a Postgrest error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("assets", "select failed");
    const repo = new AssetRepository(client);
    const asset = unwrap(new AssetBuilder().build());

    const error = unwrapErr(await repo.findById(asset.id));
    expect(error.message).toContain("AssetRepository.findById failed");
  });

  it("findById() surfaces a row-mapping error", async () => {
    const client = createFakeSupabaseClient();
    const repo = new AssetRepository(client);
    const asset = unwrap(new AssetBuilder().build());
    client.seed("assets", [{ ...AssetMapper.toRow(asset), type: "NOT_A_TYPE" }]);

    const error = unwrapErr(await repo.findById(asset.id));
    expect(error.message).toContain("row mapping failed");
  });

  it("update() persists changes and returns the mapped Asset", async () => {
    const client = createFakeSupabaseClient();
    const repo = new AssetRepository(client);
    const asset = unwrap(new AssetBuilder().build());
    await repo.insert(asset);

    const archived = asset.withStatus(AssetStatus.ARCHIVED, new Date("2026-02-01T00:00:00.000Z"));
    const updated = unwrap(await repo.update(archived));
    expect(updated.status).toBe(AssetStatus.ARCHIVED);
  });

  it("update() surfaces a 'no row returned' error when nothing matches", async () => {
    const client = createFakeSupabaseClient();
    const repo = new AssetRepository(client);
    const asset = unwrap(new AssetBuilder().build());

    const error = unwrapErr(await repo.update(asset));
    expect(error.message).toContain("no row returned");
  });

  it("update() surfaces a Postgrest error", async () => {
    const client = createFakeSupabaseClient();
    const repo = new AssetRepository(client);
    const asset = unwrap(new AssetBuilder().build());
    await repo.insert(asset);
    client.forceErrorOnce("assets", "update failed");

    const error = unwrapErr(await repo.update(asset));
    expect(error.message).toContain("AssetRepository.update failed");
  });

  it("findByUnitId() filters by unit and status, ordered newest first", async () => {
    const client = createFakeSupabaseClient();
    const repo = new AssetRepository(client);
    const older = unwrap(
      new AssetBuilder()
        .withUnitId("unit-1")
        .withCreatedAt(new Date("2026-01-01T00:00:00.000Z"))
        .build(),
    );
    const newer = unwrap(
      new AssetBuilder()
        .withUnitId("unit-1")
        .withCreatedAt(new Date("2026-02-01T00:00:00.000Z"))
        .build(),
    );
    const otherUnit = unwrap(new AssetBuilder().withUnitId("unit-2").build());
    await repo.insert(older);
    await repo.insert(newer);
    await repo.insert(otherUnit);

    const found = unwrap(await repo.findByUnitId("unit-1"));
    expect(found.map((a) => a.id.toString())).toEqual([newer.id.toString(), older.id.toString()]);
  });

  it("findByUnitId() filters by status when provided", async () => {
    const client = createFakeSupabaseClient();
    const repo = new AssetRepository(client);
    const active = unwrap(
      new AssetBuilder().withUnitId("unit-1").withStatus(AssetStatus.ACTIVE).build(),
    );
    const archived = unwrap(
      new AssetBuilder().withUnitId("unit-1").withStatus(AssetStatus.ARCHIVED).build(),
    );
    await repo.insert(active);
    await repo.insert(archived);

    const found = unwrap(await repo.findByUnitId("unit-1", AssetStatus.ACTIVE));
    expect(found).toHaveLength(1);
    expect(found[0]?.status).toBe(AssetStatus.ACTIVE);
  });

  it("findByUnitId() surfaces a row-mapping error from a bad row in the result set", async () => {
    const client = createFakeSupabaseClient();
    const repo = new AssetRepository(client);
    const good = unwrap(new AssetBuilder().withUnitId("unit-1").build());
    client.seed("assets", [
      AssetMapper.toRow(good),
      { ...AssetMapper.toRow(good), id: "bad-row", type: "NOT_A_TYPE" },
    ]);

    const error = unwrapErr(await repo.findByUnitId("unit-1"));
    expect(error.message).toContain("row mapping failed");
  });

  it("findByUnitId() surfaces a Postgrest error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("assets", "select failed");
    const repo = new AssetRepository(client);

    const error = unwrapErr(await repo.findByUnitId("unit-1"));
    expect(error.message).toContain("AssetRepository.findByUnitId failed");
  });

  it("findByBranch() filters by branch", async () => {
    const client = createFakeSupabaseClient();
    const repo = new AssetRepository(client);
    const bintaro = unwrap(new AssetBuilder().withBranch(Branch.BINTARO).build());
    const cinere = unwrap(new AssetBuilder().withBranch(Branch.CINERE).build());
    await repo.insert(bintaro);
    await repo.insert(cinere);

    const found = unwrap(await repo.findByBranch(Branch.BINTARO));
    expect(found.map((a) => a.id.toString())).toEqual([bintaro.id.toString()]);
  });

  it("findByBranch() surfaces a Postgrest error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("assets", "select failed");
    const repo = new AssetRepository(client);

    const error = unwrapErr(await repo.findByBranch(Branch.BINTARO));
    expect(error.message).toContain("AssetRepository.findByBranch failed");
  });

  it("findByType() filters by type", async () => {
    const client = createFakeSupabaseClient();
    const repo = new AssetRepository(client);
    const brand = unwrap(new AssetBuilder().withType(AssetType.BRAND).build());
    const photo = unwrap(new AssetBuilder().withType(AssetType.UNIT_PHOTO).build());
    await repo.insert(brand);
    await repo.insert(photo);

    const found = unwrap(await repo.findByType(AssetType.BRAND));
    expect(found.map((a) => a.id.toString())).toEqual([brand.id.toString()]);
  });

  it("findByType() filters by status when provided", async () => {
    const client = createFakeSupabaseClient();
    const repo = new AssetRepository(client);
    const active = unwrap(
      new AssetBuilder().withType(AssetType.BRAND).withStatus(AssetStatus.ACTIVE).build(),
    );
    const archived = unwrap(
      new AssetBuilder().withType(AssetType.BRAND).withStatus(AssetStatus.ARCHIVED).build(),
    );
    await repo.insert(active);
    await repo.insert(archived);

    const found = unwrap(await repo.findByType(AssetType.BRAND, AssetStatus.ACTIVE));
    expect(found).toHaveLength(1);
  });

  it("findByType() surfaces a Postgrest error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("assets", "select failed");
    const repo = new AssetRepository(client);

    const error = unwrapErr(await repo.findByType(AssetType.BRAND));
    expect(error.message).toContain("AssetRepository.findByType failed");
  });
});
