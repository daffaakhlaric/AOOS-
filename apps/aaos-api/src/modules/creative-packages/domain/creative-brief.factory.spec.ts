import { describe, expect, it } from "vitest";

import { BRIEF_FORMATS, buildCreativeBrief } from "./creative-brief.factory.js";
import type { StoredCreativePackage } from "./creative-package.js";

const BASE: StoredCreativePackage = {
  id: "11111111-1111-4111-8111-111111111111",
  tenantId: "dss-motor",
  briefId: "22222222-2222-4222-8222-222222222222",
  branch: "CINERE",
  unit: "xpander-gls-2022-001",
  unitModel: "Xpander GLS 2022",
  title: "Xpander GLS 2022 CINERE · DP_RINGAN",
  angle: "DP_RINGAN",
  targetPersona: "PRIMARY_FAMILY",
  reason: "Brief manual dibuat manager.",
  requestedFormat: "VIDEO_AND_IMAGES",
  primaryMessage: "DP mulai 29 juta, cicilan 5 jutaan",
  urgency: "HIGH",
  origin: "MANUAL",
  status: "DRAFT",
  sourcePhotoUrls: [],
  imageUrls: [],
  copyVariants: [],
  createdAt: "2026-08-18T00:00:00.000Z",
  updatedAt: "2026-08-18T00:00:00.000Z",
};

const NOW = new Date("2026-08-18T00:00:00.000Z");

describe("buildCreativeBrief", () => {
  it("builds a real, validated CreativeBrief from a persisted package", () => {
    const result = buildCreativeBrief({ pkg: BASE, createdAt: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const brief = result.value;
    expect(brief.id.toString()).toBe(BASE.briefId);
    expect(brief.unit).toBe("xpander-gls-2022-001");
    expect(brief.branch).toBe("CINERE");
    expect(brief.angle).toBe("DP_RINGAN");
    expect(brief.targetPersona).toBe("PRIMARY_FAMILY");
    expect(brief.primaryMessage).toBe("DP mulai 29 juta, cicilan 5 jutaan");
    expect(brief.urgency).toBe("HIGH");
    expect(brief.reason).toBe("Brief manual dibuat manager.");
    expect(brief.createdAt).toBe(NOW);
  });

  it(
    "REAL BUG FIX regression guard: carries pkg.unitModel through onto the brief, so " +
      "AutomotivePromptBuilder gets a real human-readable name instead of only the scraped " +
      "identityKey/slug",
    () => {
      const result = buildCreativeBrief({ pkg: BASE, createdAt: NOW });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.unitModel).toBe("Xpander GLS 2022");
    },
  );

  it("leaves unitModel undefined when the persisted package has none (never fabricated)", () => {
    const { unitModel: _dropped, ...withoutUnitModel } = BASE;
    const result = buildCreativeBrief({ pkg: withoutUnitModel, createdAt: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.unitModel).toBeUndefined();
  });

  it("maps VIDEO_AND_IMAGES onto the brief formats FormatDecider really reads", () => {
    const result = buildCreativeBrief({ pkg: BASE, createdAt: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // A VIDEO_* member is what lets `FormatDecider` choose VIDEO_AND_IMAGES at all.
    expect([...result.value.formats]).toEqual(["VIDEO_15S", "IMAGE_SQUARE"]);
    expect(BRIEF_FORMATS.VIDEO_AND_IMAGES).toEqual(["VIDEO_15S", "IMAGE_SQUARE"]);
  });

  it("maps IMAGES_ONLY onto an image-only format list (no video credits requested)", () => {
    const result = buildCreativeBrief({
      pkg: { ...BASE, requestedFormat: "IMAGES_ONLY" },
      createdAt: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.value.formats]).toEqual(["IMAGE_SQUARE"]);
    expect(result.value.formats.some((format) => format.startsWith("VIDEO"))).toBe(false);
  });

  it("uses the package's own id as adId for a manual brief with no originating ad", () => {
    const result = buildCreativeBrief({ pkg: BASE, createdAt: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.adId).toBe(BASE.id);
  });

  it("carries the real ad id through for a Tamara-originated brief", () => {
    const result = buildCreativeBrief({
      pkg: { ...BASE, origin: "TAMARA", adId: "120000000000001" },
      createdAt: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.adId).toBe("120000000000001");
  });

  it("fails (never throws) when the persisted briefId is not a UUID", () => {
    const result = buildCreativeBrief({ pkg: { ...BASE, briefId: "KAI-001" }, createdAt: NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/CreativeBriefId must be a UUID/);
  });

  it("fails when a persisted angle is not a real AdAngle member (e.g. the spec's invented PROMO)", () => {
    const result = buildCreativeBrief({ pkg: { ...BASE, angle: "PROMO" }, createdAt: NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/must be a valid AdAngle/);
  });

  it("fails when a persisted branch is not a real Branch member", () => {
    const result = buildCreativeBrief({ pkg: { ...BASE, branch: "MARS" }, createdAt: NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/must be a valid Branch/);
  });
});
