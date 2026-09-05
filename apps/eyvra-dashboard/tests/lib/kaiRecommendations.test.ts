import { describe, expect, it } from "vitest";

import { recommendPropertyAngles } from "@/lib/kaiRecommendations";
import type { CreativePackageDto } from "@/types/dashboard.types";

const ANGLES = ["DP_RINGAN", "READY_HUNI", "INVESTASI", "EXCLUSIVE"] as const;

function pkg(overrides: Partial<CreativePackageDto> = {}): CreativePackageDto {
  return {
    id: "pkg-1",
    briefId: "brief-1",
    vertical: "PROPERTY",
    listingId: "listing-a",
    title: "Brief",
    angle: "READY_HUNI",
    reason: "",
    requestedFormat: "IMAGES_ONLY",
    primaryMessage: "",
    urgency: "MEDIUM",
    origin: "MANUAL",
    status: "APPROVED",
    aiRecommended: false,
    sourcePhotoUrls: [],
    imageUrls: [],
    copyVariants: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("recommendPropertyAngles (Sprint 5 Prompt 14, deterministic threshold logic)", () => {
  it("recommends nothing for an angle already used on the current listing", () => {
    const packages = [pkg({ listingId: "listing-x", angle: "READY_HUNI", status: "APPROVED" })];
    const result = recommendPropertyAngles(
      [...packages, pkg({ listingId: "listing-x", angle: "READY_HUNI", status: "APPROVED" })],
      "listing-x",
      ANGLES,
    );
    expect(result.find((r) => r.angle === "READY_HUNI")).toBeUndefined();
  });

  it("recommends nothing for an angle with zero real evidence anywhere (never fabricates a reason)", () => {
    const result = recommendPropertyAngles([], "listing-x", ANGLES);
    expect(result).toHaveLength(0);
  });

  it("TINGGI confidence + pre-checked when an angle was APPROVED for >= 3 other real listings", () => {
    const packages = ["listing-1", "listing-2", "listing-3"].map((listingId) =>
      pkg({ listingId, angle: "INVESTASI", status: "APPROVED" }),
    );
    const result = recommendPropertyAngles(packages, "listing-x", ANGLES);
    const rec = result.find((r) => r.angle === "INVESTASI");
    expect(rec?.confidence).toBe("TINGGI");
    expect(rec?.preChecked).toBe(true);
    expect(rec?.reasoning).toContain("3 listing lain");
  });

  it("SEDANG confidence, NOT pre-checked, when approved for 1-2 other listings", () => {
    const packages = [pkg({ listingId: "listing-1", angle: "EXCLUSIVE", status: "APPROVED" })];
    const result = recommendPropertyAngles(packages, "listing-x", ANGLES);
    const rec = result.find((r) => r.angle === "EXCLUSIVE");
    expect(rec?.confidence).toBe("SEDANG");
    expect(rec?.preChecked).toBe(false);
  });

  it("COBA_COBA confidence when the angle was used elsewhere but never approved", () => {
    const packages = [pkg({ listingId: "listing-1", angle: "DP_RINGAN", status: "PENDING" })];
    const result = recommendPropertyAngles(packages, "listing-x", ANGLES);
    const rec = result.find((r) => r.angle === "DP_RINGAN");
    expect(rec?.confidence).toBe("COBA_COBA");
    expect(rec?.preChecked).toBe(false);
    expect(rec?.reasoning).toContain("belum ada yang disetujui");
  });

  it("ignores AUTOMOTIVE packages and packages with no listingId entirely (real vertical/shape guard)", () => {
    const packages = [
      pkg({ vertical: "AUTOMOTIVE", listingId: undefined, angle: "INVESTASI", status: "APPROVED" }),
      pkg({ vertical: "PROPERTY", listingId: undefined, angle: "INVESTASI", status: "APPROVED" }),
    ];
    const result = recommendPropertyAngles(packages, "listing-x", ANGLES);
    expect(result.find((r) => r.angle === "INVESTASI")).toBeUndefined();
  });

  it("ranks TINGGI before SEDANG before COBA_COBA and caps at 3 recommendations", () => {
    const packages = [
      ...["listing-1"].map((id) => pkg({ listingId: id, angle: "DP_RINGAN", status: "PENDING" })), // COBA_COBA
      ...["listing-2"].map((id) => pkg({ listingId: id, angle: "EXCLUSIVE", status: "APPROVED" })), // SEDANG
      ...["listing-3", "listing-4", "listing-5"].map((id) =>
        pkg({ listingId: id, angle: "INVESTASI", status: "APPROVED" }),
      ), // TINGGI
    ];
    const result = recommendPropertyAngles(packages, "listing-x", ANGLES);
    expect(result[0]?.confidence).toBe("TINGGI");
    expect(result.length).toBeLessThanOrEqual(3);
  });
});
