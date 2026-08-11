import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { AssetBuilder } from "../../../src/builders/AssetBuilder.js";
import { AssetType } from "../../../src/domain/value-objects/AssetType.js";
import { AssetMapper, type AssetRow } from "../../../src/infrastructure/mappers/AssetMapper.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function validRow(overrides: Partial<AssetRow> = {}): AssetRow {
  return {
    id: "asset-1",
    tenant_id: "dss-motor",
    type: "UNIT_PHOTO",
    status: "ACTIVE",
    storage_path: "units/unit-1/photo-1700000000000.jpg",
    public_url:
      "https://example.supabase.co/storage/v1/object/public/mobix-assets/units/unit-1/photo-1.jpg",
    file_name: "photo-1.jpg",
    mime_type: "image/jpeg",
    file_size: 2048,
    tags: ["type:UNIT_PHOTO", "branch:BINTARO"],
    unit_id: "unit-1",
    unit_model: "Xpander Cross",
    unit_year: 2019,
    branch: "BINTARO",
    ai_prompt: null,
    ai_model: null,
    creative_brief_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("AssetMapper", () => {
  describe("toDomain", () => {
    it("maps a full row to a valid Asset", () => {
      const asset = unwrap(AssetMapper.toDomain(validRow()));
      expect(asset.id.toString()).toBe("asset-1");
      expect(asset.tenantId).toBe("dss-motor");
      expect(asset.unitId).toBe("unit-1");
      expect(asset.unitModel).toBe("Xpander Cross");
      expect(asset.unitYear).toBe(2019);
      expect(asset.branch).toBe(Branch.BINTARO);
      expect(asset.tags.map((t) => t.toString())).toEqual(["type:UNIT_PHOTO", "branch:BINTARO"]);
    });

    it("maps null optional columns to undefined", () => {
      const asset = unwrap(
        AssetMapper.toDomain(
          validRow({
            type: "BRAND",
            unit_id: null,
            unit_model: null,
            unit_year: null,
            branch: null,
          }),
        ),
      );
      expect(asset.unitId).toBeUndefined();
      expect(asset.unitModel).toBeUndefined();
      expect(asset.unitYear).toBeUndefined();
      expect(asset.branch).toBeUndefined();
    });

    it("maps AI creative columns when present", () => {
      const asset = unwrap(
        AssetMapper.toDomain(
          validRow({
            type: "AI_IMAGE",
            unit_id: null,
            ai_prompt: "a red car",
            ai_model: "veo",
            creative_brief_id: "brief-1",
          }),
        ),
      );
      expect(asset.aiPrompt).toBe("a red car");
      expect(asset.aiModel).toBe("veo");
      expect(asset.creativeBriefId).toBe("brief-1");
    });

    it("rejects an invalid id", () => {
      const error = unwrapErr(AssetMapper.toDomain(validRow({ id: "" })));
      expect(error.message).toContain("AssetId");
    });

    it("rejects an unknown type", () => {
      const error = unwrapErr(AssetMapper.toDomain(validRow({ type: "NOT_A_TYPE" })));
      expect(error.message).toContain("unknown asset type");
    });

    it("rejects an unknown status", () => {
      const error = unwrapErr(AssetMapper.toDomain(validRow({ status: "NOT_A_STATUS" })));
      expect(error.message).toContain("unknown asset status");
    });

    it("rejects an invalid storage_path", () => {
      const error = unwrapErr(AssetMapper.toDomain(validRow({ storage_path: "" })));
      expect(error.message).toContain("StoragePath");
    });

    it("rejects an invalid public_url", () => {
      const error = unwrapErr(AssetMapper.toDomain(validRow({ public_url: "not-a-url" })));
      expect(error.message).toContain("PublicUrl");
    });

    it("rejects an invalid mime_type", () => {
      const error = unwrapErr(AssetMapper.toDomain(validRow({ mime_type: "application/pdf" })));
      expect(error.message).toContain("MimeType");
    });

    it("rejects a negative file_size", () => {
      const error = unwrapErr(AssetMapper.toDomain(validRow({ file_size: -1 })));
      expect(error.message).toContain("FileSize");
    });

    it("rejects an invalid tag", () => {
      const error = unwrapErr(AssetMapper.toDomain(validRow({ tags: [""] })));
      expect(error.message).toContain("AssetTag");
    });

    it("rejects a row that fails Asset.create's own validation (UNIT_PHOTO with no unit_id)", () => {
      const error = unwrapErr(
        AssetMapper.toDomain(validRow({ type: "UNIT_PHOTO", unit_id: null })),
      );
      expect(error.message).toContain("unitId");
    });
  });

  describe("toRow", () => {
    it("round-trips an Asset through toRow -> toDomain", () => {
      const asset = unwrap(
        new AssetBuilder()
          .withUnitId("unit-9")
          .withUnitModel("Pajero Sport")
          .withUnitYear(2021)
          .withBranch(Branch.CINERE)
          .withTags(["angle:front"])
          .build(),
      );
      const row = AssetMapper.toRow(asset);
      const roundTripped = unwrap(AssetMapper.toDomain(row));
      expect(roundTripped.id.equals(asset.id)).toBe(true);
      expect(roundTripped.unitId).toBe("unit-9");
      expect(roundTripped.unitModel).toBe("Pajero Sport");
      expect(roundTripped.unitYear).toBe(2021);
      expect(roundTripped.branch).toBe(Branch.CINERE);
      expect(roundTripped.tags.map((t) => t.toString())).toEqual(["angle:front"]);
    });

    it("maps undefined optional fields to null columns", () => {
      const asset = unwrap(
        new AssetBuilder().withType(AssetType.BRAND).withUnitId(undefined).build(),
      );
      const row = AssetMapper.toRow(asset);
      expect(row.unit_id).toBeNull();
      expect(row.unit_model).toBeNull();
      expect(row.unit_year).toBeNull();
      expect(row.ai_prompt).toBeNull();
      expect(row.ai_model).toBeNull();
      expect(row.creative_brief_id).toBeNull();
    });
  });
});
