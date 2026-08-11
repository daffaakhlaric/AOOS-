import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { Asset } from "../../../src/domain/entities/Asset.js";
import { AssetId } from "../../../src/domain/value-objects/AssetId.js";
import { AssetStatus } from "../../../src/domain/value-objects/AssetStatus.js";
import { AssetTag } from "../../../src/domain/value-objects/AssetTag.js";
import { AssetType } from "../../../src/domain/value-objects/AssetType.js";
import { FileSize } from "../../../src/domain/value-objects/FileSize.js";
import { MimeType } from "../../../src/domain/value-objects/MimeType.js";
import { PublicUrl } from "../../../src/domain/value-objects/PublicUrl.js";
import { StoragePath } from "../../../src/domain/value-objects/StoragePath.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function baseProps() {
  return {
    id: AssetId.generate(),
    tenantId: "dss-motor",
    type: AssetType.BRAND,
    status: AssetStatus.ACTIVE,
    storagePath: StoragePath.brandAsset("logo.png"),
    publicUrl: unwrap(PublicUrl.create("https://example.com/logo.png")),
    fileName: "logo.png",
    mimeType: unwrap(MimeType.create("image/png")),
    fileSize: unwrap(FileSize.create(2048)),
    tags: [] as AssetTag[],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

describe("Asset", () => {
  it("create() succeeds with valid props", () => {
    const asset = unwrap(Asset.create(baseProps()));
    expect(asset.fileName).toBe("logo.png");
    expect(asset.status).toBe(AssetStatus.ACTIVE);
    expect(asset.tags).toEqual([]);
  });

  it("create() rejects an empty tenantId", () => {
    const error = unwrapErr(Asset.create({ ...baseProps(), tenantId: "" }));
    expect(error.message).toContain("tenantId");
  });

  it("create() rejects an empty fileName", () => {
    const error = unwrapErr(Asset.create({ ...baseProps(), fileName: "" }));
    expect(error.message).toContain("fileName");
  });

  it("create() requires unitId when type is UNIT_PHOTO", () => {
    const error = unwrapErr(
      Asset.create({ ...baseProps(), type: AssetType.UNIT_PHOTO, unitId: undefined }),
    );
    expect(error.message).toContain("unitId");
  });

  it("create() succeeds for UNIT_PHOTO when unitId is present", () => {
    const asset = unwrap(
      Asset.create({ ...baseProps(), type: AssetType.UNIT_PHOTO, unitId: "unit-1" }),
    );
    expect(asset.unitId).toBe("unit-1");
  });

  it("create() rejects an implausible unitYear", () => {
    const error = unwrapErr(Asset.create({ ...baseProps(), unitYear: 1800 }));
    expect(error.message).toContain("unitYear");
  });

  it("create() accepts a plausible unitYear", () => {
    const asset = unwrap(Asset.create({ ...baseProps(), unitYear: 2019 }));
    expect(asset.unitYear).toBe(2019);
  });

  it("getters expose every prop", () => {
    const props = {
      ...baseProps(),
      unitId: "unit-1",
      unitModel: "Xpander Cross",
      unitYear: 2019,
      branch: Branch.BINTARO,
      aiPrompt: "a red car",
      aiModel: "veo",
      creativeBriefId: "brief-1",
    };
    const asset = unwrap(Asset.create({ ...props, type: AssetType.UNIT_PHOTO }));
    expect(asset.id).toBe(props.id);
    expect(asset.tenantId).toBe("dss-motor");
    expect(asset.type).toBe(AssetType.UNIT_PHOTO);
    expect(asset.storagePath).toBe(props.storagePath);
    expect(asset.publicUrl).toBe(props.publicUrl);
    expect(asset.mimeType).toBe(props.mimeType);
    expect(asset.fileSize).toBe(props.fileSize);
    expect(asset.unitModel).toBe("Xpander Cross");
    expect(asset.branch).toBe(Branch.BINTARO);
    expect(asset.aiPrompt).toBe("a red car");
    expect(asset.aiModel).toBe("veo");
    expect(asset.creativeBriefId).toBe("brief-1");
    expect(asset.createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(asset.updatedAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("withStatus() returns a new Asset with the updated status", () => {
    const asset = unwrap(Asset.create(baseProps()));
    const archivedAt = new Date("2026-02-01T00:00:00.000Z");
    const archived = asset.withStatus(AssetStatus.ARCHIVED, archivedAt);
    expect(archived).not.toBe(asset);
    expect(archived.status).toBe(AssetStatus.ARCHIVED);
    expect(archived.updatedAt).toEqual(archivedAt);
    expect(asset.status).toBe(AssetStatus.ACTIVE);
  });

  it("withTags() returns a new Asset with the updated tags", () => {
    const asset = unwrap(Asset.create(baseProps()));
    const tag = unwrap(AssetTag.create("branch:BINTARO"));
    const updatedAt = new Date("2026-02-01T00:00:00.000Z");
    const tagged = asset.withTags([tag], updatedAt);
    expect(tagged).not.toBe(asset);
    expect(tagged.tags).toEqual([tag]);
    expect(tagged.updatedAt).toEqual(updatedAt);
    expect(asset.tags).toEqual([]);
  });
});
