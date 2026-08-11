import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { AssetBuilder } from "../../../src/builders/AssetBuilder.js";
import { AssetId } from "../../../src/domain/value-objects/AssetId.js";
import { AssetStatus } from "../../../src/domain/value-objects/AssetStatus.js";
import { AssetType } from "../../../src/domain/value-objects/AssetType.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("AssetBuilder", () => {
  it("build() with defaults produces a valid Asset", () => {
    const asset = unwrap(new AssetBuilder().build());
    expect(asset.type).toBe(AssetType.UNIT_PHOTO);
    expect(asset.status).toBe(AssetStatus.ACTIVE);
    expect(asset.branch).toBe(Branch.BINTARO);
  });

  it("every with*() setter overrides the built Asset", () => {
    const id = AssetId.generate();
    const asset = unwrap(
      new AssetBuilder()
        .withId(id)
        .withTenantId("acme")
        .withType(AssetType.BRAND)
        .withStatus(AssetStatus.ARCHIVED)
        .withStoragePath("brand/logo.png")
        .withPublicUrl("https://example.com/logo.png")
        .withFileName("logo.png")
        .withMimeType("image/png")
        .withFileSize(4096)
        .withTags(["a", "b"])
        .withUnitId(undefined)
        .withUnitModel("Xpander Cross")
        .withUnitYear(2019)
        .withBranch(Branch.CINERE)
        .withAiPrompt("a prompt")
        .withAiModel("veo")
        .withCreativeBriefId("brief-1")
        .withCreatedAt(new Date("2026-03-01T00:00:00.000Z"))
        .withUpdatedAt(new Date("2026-03-02T00:00:00.000Z"))
        .build(),
    );
    expect(asset.id).toBe(id);
    expect(asset.tenantId).toBe("acme");
    expect(asset.type).toBe(AssetType.BRAND);
    expect(asset.status).toBe(AssetStatus.ARCHIVED);
    expect(asset.storagePath.toString()).toBe("brand/logo.png");
    expect(asset.publicUrl.toString()).toBe("https://example.com/logo.png");
    expect(asset.fileName).toBe("logo.png");
    expect(asset.mimeType.toString()).toBe("image/png");
    expect(asset.fileSize.bytes).toBe(4096);
    expect(asset.tags.map((t) => t.toString())).toEqual(["a", "b"]);
    expect(asset.unitId).toBeUndefined();
    expect(asset.unitModel).toBe("Xpander Cross");
    expect(asset.unitYear).toBe(2019);
    expect(asset.branch).toBe(Branch.CINERE);
    expect(asset.aiPrompt).toBe("a prompt");
    expect(asset.aiModel).toBe("veo");
    expect(asset.creativeBriefId).toBe("brief-1");
    expect(asset.createdAt).toEqual(new Date("2026-03-01T00:00:00.000Z"));
    expect(asset.updatedAt).toEqual(new Date("2026-03-02T00:00:00.000Z"));
  });

  it("build() propagates an invalid storagePath as an error", () => {
    const error = unwrapErr(new AssetBuilder().withStoragePath("").build());
    expect(error.message).toContain("StoragePath");
  });

  it("build() propagates an invalid publicUrl as an error", () => {
    const error = unwrapErr(new AssetBuilder().withPublicUrl("not-a-url").build());
    expect(error.message).toContain("PublicUrl");
  });

  it("build() propagates an invalid mimeType as an error", () => {
    const error = unwrapErr(new AssetBuilder().withMimeType("application/pdf").build());
    expect(error.message).toContain("MimeType");
  });

  it("build() propagates an invalid fileSize as an error", () => {
    const error = unwrapErr(new AssetBuilder().withFileSize(-1).build());
    expect(error.message).toContain("FileSize");
  });

  it("build() propagates an invalid tag as an error", () => {
    const error = unwrapErr(new AssetBuilder().withTags([""]).build());
    expect(error.message).toContain("AssetTag");
  });

  it("build() propagates an Asset.create() validation error", () => {
    const error = unwrapErr(new AssetBuilder().withTenantId("").build());
    expect(error.message).toContain("tenantId");
  });
});
