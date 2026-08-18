import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import type { ScrapeWarning } from "../../../src/domain/events/ScrapeWarning.js";
import { UnitUrl } from "../../../src/domain/value-objects/UnitUrl.js";
import {
  absolutePhotoUrl,
  normalizeTransmission,
  toScrapedUnit,
  UNIT_PATH_PREFIX,
} from "../../../src/infrastructure/api/MobixUnitMapper.js";
import {
  API_ORIGIN,
  REAL_ITEM_XPANDER_CROSS,
  REAL_ITEM_XPANDER_GLS,
  realItemWithoutOdometer,
} from "../../helpers/mobixApi.js";

const clock = () => new Date("2026-08-17T13:03:09.000Z");

function map(raw: unknown, onWarning?: (w: ScrapeWarning) => void) {
  return toScrapedUnit(raw, {
    origin: API_ORIGIN,
    clock,
    ...(onWarning !== undefined ? { onWarning } : {}),
  });
}

describe("normalizeTransmission", () => {
  it.each([
    ["MANUAL", "MT"],
    ["manual", "MT"],
    ["AUTOMATIC", "AT"],
    ["automatic", "AT"],
  ])("maps the real API value %s to %s", (raw, expected) => {
    const result = normalizeTransmission(raw);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(expected);
  });

  it("treats an unrecognized transmission as a real parse error rather than defaulting", () => {
    const result = normalizeTransmission("CVT-ISH");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("CVT-ISH");
  });
});

describe("absolutePhotoUrl", () => {
  // REAL BUG FIX regression guard: `https://mobixbydss.id/unit-file-serve?...` 404s unconditionally
  // (confirmed live, even for a freshly-scraped path) — the real file-serving backend is a
  // different host, `mobix.motovax.com`, confirmed via a live browser Network-tab capture.
  const PHOTO_CDN_ORIGIN = "https://mobix.motovax.com";

  it("resolves against the real photo CDN origin, NOT the scraped site's own origin", () => {
    const absolute = absolutePhotoUrl(REAL_ITEM_XPANDER_GLS.thumbnail);

    expect(absolute.startsWith(PHOTO_CDN_ORIGIN)).toBe(true);
    expect(absolute.startsWith(API_ORIGIN)).toBe(false);
  });

  it("keeps the percent-encoded ?path= query intact (it must not be double-encoded)", () => {
    const absolute = absolutePhotoUrl(REAL_ITEM_XPANDER_GLS.thumbnail);

    expect(absolute).toContain("path=%2Fdata%2Fvehicle-media%2F");
  });

  it("appends raw=1 — without it the CDN serves a re-encoded thumbnail, not the original", () => {
    const absolute = absolutePhotoUrl(REAL_ITEM_XPANDER_GLS.thumbnail);

    expect(new URL(absolute).searchParams.get("raw")).toBe("1");
  });
});

describe("toScrapedUnit (real /api/get-all-produk items)", () => {
  it("maps every field off the real Xpander GLS item", () => {
    const result = map(REAL_ITEM_XPANDER_GLS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const unit = result.value;
    // `type`, not `nama` — `nama` bundles brand + year + color.
    expect(unit.model).toBe("Xpander GLS MT");
    expect(unit.brand).toBe("Mitsubishi");
    expect(unit.year).toBe(2022);
    expect(unit.transmission).toBe("MT");
    expect(unit.color).toBe("Hitam");
    expect(unit.kilometer.km).toBe(60845);
    expect(unit.price.idr).toBe(180000000);
    expect(unit.branch).toBe(Branch.BINTARO);
    expect(unit.available).toBe(true);
    expect(unit.scrapedAt.value).toEqual(clock());
  });

  it("builds a UnitUrl whose slug round-trips back to the API's own slug", () => {
    const result = map(REAL_ITEM_XPANDER_GLS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // This is the invariant `ScrapedUnit.identityKey` depends on.
    expect(result.value.identityKey).toBe(REAL_ITEM_XPANDER_GLS.slug);
    expect(result.value.url.href).toBe(
      `${API_ORIGIN}${UNIT_PATH_PREFIX}${REAL_ITEM_XPANDER_GLS.slug}`,
    );

    const reparsed = UnitUrl.create(
      `${API_ORIGIN}${UNIT_PATH_PREFIX}${REAL_ITEM_XPANDER_GLS.slug}`,
    );
    expect(reparsed.ok).toBe(true);
    if (reparsed.ok) expect(reparsed.value.slug).toBe(REAL_ITEM_XPANDER_GLS.slug);
  });

  it("carries exactly ONE absolute thumbnail at listing time (the gallery comes from the detail endpoint)", () => {
    const result = map(REAL_ITEM_XPANDER_GLS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.photos).toEqual([absolutePhotoUrl(REAL_ITEM_XPANDER_GLS.thumbnail)]);
  });

  it("falls back to thumbnail_depan when `thumbnail` is absent, as on the real Xpander Cross item", () => {
    const result = map(REAL_ITEM_XPANDER_CROSS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.photos).toEqual([
      absolutePhotoUrl(REAL_ITEM_XPANDER_CROSS.thumbnail_depan),
    ]);
  });

  it("maps AUTOMATIC to AT and uppercase merek verbatim on the real Xpander Cross item", () => {
    const result = map(REAL_ITEM_XPANDER_CROSS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.transmission).toBe("AT");
    expect(result.value.brand).toBe("MITSUBISHI");
    expect(result.value.year).toBe(2023);
    expect(result.value.price.idr).toBe(275000000);
  });

  it("defaults a MISSING odometer to 0 instead of failing the item (real brand-new unit)", () => {
    const result = map(realItemWithoutOdometer());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kilometer.km).toBe(0);
    expect(result.value.year).toBe(2026);
  });

  it("falls back to Branch.UMUM and emits a branch_fallback warning for the real PONDOK BAMBU branch", () => {
    const onWarning = vi.fn();

    const result = map(REAL_ITEM_XPANDER_CROSS, onWarning);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.branch).toBe(Branch.UMUM);
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(onWarning).toHaveBeenCalledWith({
      type: "branch_fallback",
      rawCabang: "PONDOK BAMBU",
      slug: REAL_ITEM_XPANDER_CROSS.slug,
      fallback: Branch.UMUM,
    });
  });

  it('warns for the real internal "hq3" cabang too', () => {
    const onWarning = vi.fn();

    const result = map({ ...REAL_ITEM_XPANDER_GLS, cabang: "hq3" }, onWarning);

    expect(result.ok).toBe(true);
    expect(onWarning.mock.calls[0]?.[0]).toMatchObject({ rawCabang: "hq3" });
  });

  it("maps a known branch without emitting any warning", () => {
    const onWarning = vi.fn();

    map(REAL_ITEM_XPANDER_GLS, onWarning);

    expect(onWarning).not.toHaveBeenCalled();
  });

  it("does not throw when a branch falls back and no onWarning listener is wired", () => {
    const result = map(REAL_ITEM_XPANDER_CROSS);

    expect(result.ok).toBe(true);
  });

  it("returns a ParseError naming the slug for an unrecognized transmisi", () => {
    const result = map({ ...REAL_ITEM_XPANDER_GLS, transmisi: "TIPTRONIC" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("TIPTRONIC");
      expect(result.error.message).toContain(REAL_ITEM_XPANDER_GLS.slug);
    }
  });

  it("returns a ParseError naming the slug when a required field is missing", () => {
    const { type: _dropped, ...withoutType } = REAL_ITEM_XPANDER_GLS;

    const result = map(withoutType);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain(REAL_ITEM_XPANDER_GLS.slug);
  });

  it("returns a ParseError for a non-object item, without a slug to name", () => {
    const result = map("not an object");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("<unknown slug>");
  });

  it("returns a ParseError for a negative harga (rejected by ScrapedPrice)", () => {
    const result = map({ ...REAL_ITEM_XPANDER_GLS, harga: -1 });

    expect(result.ok).toBe(false);
  });

  it("returns a ParseError for a negative odometer (rejected by ScrapedKilometer)", () => {
    const result = map({ ...REAL_ITEM_XPANDER_GLS, odometer: -5 });

    expect(result.ok).toBe(false);
  });

  it("returns a ParseError for an implausible year (rejected by ScrapedUnit)", () => {
    const result = map({ ...REAL_ITEM_XPANDER_GLS, year: 1899 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain(REAL_ITEM_XPANDER_GLS.slug);
  });

  it("returns a ParseError when the origin cannot form a valid absolute URL", () => {
    const result = toScrapedUnit(REAL_ITEM_XPANDER_GLS, { origin: "not-a-url", clock });

    expect(result.ok).toBe(false);
  });

  it("maps an item with no thumbnail at all to an empty photo list", () => {
    const { thumbnail: _t, thumbnail_depan: _td, ...noPhotos } = REAL_ITEM_XPANDER_GLS;

    const result = map(noPhotos);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.photos).toEqual([]);
  });
});
