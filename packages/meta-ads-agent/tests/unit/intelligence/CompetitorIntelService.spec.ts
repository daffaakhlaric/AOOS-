import { describe, expect, it, vi } from "vitest";

import { AdAngle } from "../../../src/domain/value-objects/AdAngle.js";
import {
  classifyAutomotiveAngle,
  classifyPropertyAngle,
  CompetitorIntelError,
  CompetitorIntelService,
  type CompetitorAd,
  type CompetitorPageConfig,
} from "../../../src/intelligence/CompetitorIntelService.js";

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

function buildService(fetchImpl: typeof fetch): CompetitorIntelService {
  return new CompetitorIntelService({
    accessToken: "APP_ID|APP_SECRET",
    fetchImpl,
  });
}

const MOBIL_PAGE: CompetitorPageConfig = {
  name: "Kompetitor A",
  pageId: "111111111",
  vertical: "AUTOMOTIVE",
};
const PROPERTY_PAGE: CompetitorPageConfig = {
  name: "Kompetitor Properti",
  pageId: "222222222",
  vertical: "PROPERTY",
};

describe("CompetitorIntelService.buildAppAccessToken", () => {
  it("builds the real {app-id}|{app-secret} App Access Token format", () => {
    expect(CompetitorIntelService.buildAppAccessToken("APPID", "SECRET")).toBe("APPID|SECRET");
  });
});

describe("CompetitorIntelService.getCompetitorAds", () => {
  it("short-circuits to Result.ok([]) with no network call when no pages are given", async () => {
    const fetchImpl = vi.fn();
    const service = buildService(fetchImpl as unknown as typeof fetch);

    const result = await service.getCompetitorAds([]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("GETs ads_archive with real search_page_ids/ad_reached_countries/ad_active_status/fields/access_token params", async () => {
    let capturedUrl: string | undefined;
    const fetchImpl = vi.fn(async (url: string | URL) => {
      capturedUrl = url.toString();
      return jsonResponse({ data: [] });
    });
    const service = buildService(fetchImpl as unknown as typeof fetch);

    await service.getCompetitorAds([MOBIL_PAGE]);

    const url = new URL(capturedUrl as string);
    expect(url.origin + url.pathname).toBe("https://graph.facebook.com/v21.0/ads_archive");
    expect(url.searchParams.get("search_page_ids")).toBe("111111111");
    expect(url.searchParams.get("ad_reached_countries")).toBe(JSON.stringify(["ID"]));
    expect(url.searchParams.get("ad_active_status")).toBe("ACTIVE");
    expect(url.searchParams.get("access_token")).toBe("APP_ID|APP_SECRET");
    expect(url.searchParams.get("fields")).toContain("ad_creative_bodies");
    expect(url.searchParams.get("fields")).toContain("publisher_platforms");
  });

  it("batches search_page_ids into groups of 10 (Meta's real limit) across multiple requests", async () => {
    const pages: CompetitorPageConfig[] = Array.from({ length: 12 }, (_, i) => ({
      name: `Kompetitor ${String(i)}`,
      pageId: String(1000 + i),
      vertical: "AUTOMOTIVE" as const,
    }));
    const capturedUrls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL) => {
      capturedUrls.push(url.toString());
      return jsonResponse({ data: [] });
    });
    const service = buildService(fetchImpl as unknown as typeof fetch);

    const result = await service.getCompetitorAds(pages);

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstChunkIds = new URL(capturedUrls[0] as string).searchParams.get("search_page_ids");
    const secondChunkIds = new URL(capturedUrls[1] as string).searchParams.get("search_page_ids");
    expect(firstChunkIds?.split(",")).toHaveLength(10);
    expect(secondChunkIds?.split(",")).toHaveLength(2);
  });

  it("maps a real ArchivedAd response into CompetitorAd, classified by the page's vertical", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: [
          {
            id: "AD1",
            page_id: MOBIL_PAGE.pageId,
            page_name: "Kompetitor A Official",
            ad_creative_bodies: ["DP mulai 10 juta aja, cicilan ringan!"],
            ad_delivery_start_time: "2026-08-01",
            publisher_platforms: ["facebook", "instagram"],
            ad_snapshot_url: "https://www.facebook.com/ads/archive/render_ad/?id=AD1",
          },
        ],
      }),
    );
    const service = buildService(fetchImpl as unknown as typeof fetch);

    const result = await service.getCompetitorAds([MOBIL_PAGE]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const ad = result.value[0] as CompetitorAd;
      expect(ad).toMatchObject({
        id: "AD1",
        pageId: MOBIL_PAGE.pageId,
        advertiserName: "Kompetitor A",
        vertical: "AUTOMOTIVE",
        adTexts: ["DP mulai 10 juta aja, cicilan ringan!"],
        platforms: ["facebook", "instagram"],
        startDate: "2026-08-01",
        angle: AdAngle.DP_RINGAN,
      });
    }
  });

  it("classifies a PROPERTY competitor's ad against real PropertyAdAngle string values", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: [
          {
            id: "AD2",
            page_id: PROPERTY_PAGE.pageId,
            ad_creative_bodies: ["Rumah ready siap huni, serah terima bulan ini!"],
            publisher_platforms: ["facebook"],
          },
        ],
      }),
    );
    const service = buildService(fetchImpl as unknown as typeof fetch);

    const result = await service.getCompetitorAds([PROPERTY_PAGE]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const ad = result.value[0] as CompetitorAd;
      expect(ad.advertiserName).toBe(PROPERTY_PAGE.name);
      expect(ad.vertical).toBe("PROPERTY");
      expect(ad.angle).toBe("READY_HUNI");
    }
  });

  it("skips ArchivedAd entries whose page_id doesn't match a requested config", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: [{ id: "STRAY", page_id: "999999999", ad_creative_bodies: ["hello"] }],
      }),
    );
    const service = buildService(fetchImpl as unknown as typeof fetch);

    const result = await service.getCompetitorAds([MOBIL_PAGE]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it("returns Result.err(CompetitorIntelError) on a non-2xx Meta error response — never treats it as zero ads", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: { message: "Invalid OAuth access token." } }, { status: 400 }),
    );
    const service = buildService(fetchImpl as unknown as typeof fetch);

    const result = await service.getCompetitorAds([MOBIL_PAGE]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(CompetitorIntelError);
      expect(result.error.message).toBe("Invalid OAuth access token.");
    }
  });

  it("returns Result.err(CompetitorIntelError) on a network failure (never throws)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ETIMEDOUT");
    });
    const service = buildService(fetchImpl as unknown as typeof fetch);

    const result = await service.getCompetitorAds([MOBIL_PAGE]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(CompetitorIntelError);
    }
  });

  it("returns Result.err(CompetitorIntelError) when the response body fails schema validation", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ unexpected: "shape" }));
    const service = buildService(fetchImpl as unknown as typeof fetch);

    const result = await service.getCompetitorAds([MOBIL_PAGE]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(CompetitorIntelError);
    }
  });

  it("fails the whole call (fails fast) if any one chunk errors, rather than returning a silent partial list", async () => {
    const pages: CompetitorPageConfig[] = Array.from({ length: 11 }, (_, i) => ({
      name: `Kompetitor ${String(i)}`,
      pageId: String(2000 + i),
      vertical: "AUTOMOTIVE" as const,
    }));
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return jsonResponse({ data: [] });
      }
      return jsonResponse({ error: { message: "Rate limited" } }, { status: 429 });
    });
    const service = buildService(fetchImpl as unknown as typeof fetch);

    const result = await service.getCompetitorAds(pages);

    expect(result.ok).toBe(false);
  });
});

describe("classifyAutomotiveAngle", () => {
  it("matches real AdAngle members from ad text keywords", () => {
    expect(classifyAutomotiveAngle("DP ringan mulai 10 juta")).toBe(AdAngle.DP_RINGAN);
    expect(classifyAutomotiveAngle("Kredit syariah tanpa riba")).toBe(AdAngle.KREDIT_SYARIAH);
    expect(classifyAutomotiveAngle("Stok puluhan unit ready di showroom")).toBe(AdAngle.GUDANGNYA);
    expect(classifyAutomotiveAngle("Sudah terpercaya, baca testimoni pelanggan")).toBe(
      AdAngle.TESTIMONIAL,
    );
    expect(classifyAutomotiveAngle("Konsultasi dan tanya dulu ke kami")).toBe(AdAngle.QNA);
    expect(classifyAutomotiveAngle("Jelajahi koleksi unit terbaru kami")).toBe(AdAngle.DISCOVERY);
    expect(classifyAutomotiveAngle("Kunjungi website kami untuk detail")).toBe(
      AdAngle.WEBSITE_REDIRECT,
    );
  });

  it("returns undefined (never a fabricated OTHER member) when nothing matches", () => {
    expect(classifyAutomotiveAngle("Selamat hari kemerdekaan Indonesia")).toBeUndefined();
  });
});

describe("classifyPropertyAngle", () => {
  it("matches real PropertyAdAngle string values from ad text keywords", () => {
    expect(classifyPropertyAngle("DP ringan cicilan mulai 1 juta")).toBe("DP_RINGAN");
    expect(classifyPropertyAngle("Rumah syariah tanpa riba")).toBe("SYARIAH");
    expect(classifyPropertyAngle("Lihat virtual tour 360 sekarang")).toBe("VIRTUAL_TOUR");
    expect(classifyPropertyAngle("Ready siap huni bulan ini")).toBe("READY_HUNI");
    expect(classifyPropertyAngle("Properti investasi capital gain tinggi")).toBe("INVESTASI");
    expect(classifyPropertyAngle("Unit eksklusif premium terbatas")).toBe("EXCLUSIVE");
    expect(classifyPropertyAngle("Promo diskon buruan sebelum habis")).toBe("PROMO_TERBATAS");
    expect(classifyPropertyAngle("Agen terpercaya, banyak testimoni")).toBe("TESTIMONIAL");
  });

  it("returns undefined when nothing matches", () => {
    expect(classifyPropertyAngle("Selamat hari kemerdekaan Indonesia")).toBeUndefined();
  });
});

function makeAd(overrides: Partial<CompetitorAd>): CompetitorAd {
  return {
    id: "AD",
    pageId: "1",
    advertiserName: "X",
    vertical: "AUTOMOTIVE",
    adTexts: [],
    platforms: [],
    startDate: undefined,
    snapshotUrl: undefined,
    angle: undefined,
    ...overrides,
  };
}

describe("CompetitorIntelService.interpretForStrategy", () => {
  it("flags an angle as saturated once >= 3 competitor ads use it", () => {
    const ads = [
      makeAd({ angle: AdAngle.DP_RINGAN }),
      makeAd({ angle: AdAngle.DP_RINGAN }),
      makeAd({ angle: AdAngle.DP_RINGAN }),
    ];
    const signal = CompetitorIntelService.interpretForStrategy(ads, "AUTOMOTIVE");
    expect(signal.saturatedAngles).toEqual([AdAngle.DP_RINGAN]);
  });

  it("lists every real AUTOMOTIVE angle with zero competitor ads as unused", () => {
    const ads = [makeAd({ angle: AdAngle.DP_RINGAN })];
    const signal = CompetitorIntelService.interpretForStrategy(ads, "AUTOMOTIVE");
    expect(signal.unusedAngles).toEqual(
      expect.arrayContaining([
        AdAngle.KREDIT_SYARIAH,
        AdAngle.GUDANGNYA,
        AdAngle.QNA,
        AdAngle.DISCOVERY,
        AdAngle.TESTIMONIAL,
        AdAngle.WEBSITE_REDIRECT,
      ]),
    );
    expect(signal.unusedAngles).not.toContain(AdAngle.DP_RINGAN);
  });

  it("only considers ads matching the requested vertical", () => {
    const ads = [
      makeAd({ vertical: "AUTOMOTIVE", angle: AdAngle.DP_RINGAN }),
      makeAd({ vertical: "PROPERTY", angle: "INVESTASI" }),
    ];
    const signal = CompetitorIntelService.interpretForStrategy(ads, "PROPERTY");
    // Only the PROPERTY ad (angle INVESTASI) is considered — the AUTOMOTIVE ad's DP_RINGAN
    // classification must not leak into the PROPERTY signal, even though "DP_RINGAN" also
    // happens to be a real PropertyAdAngle member name (a distinct string in that vocabulary).
    expect(signal.unusedAngles).not.toContain("INVESTASI");
    expect(signal.unusedAngles).toContain("DP_RINGAN"); // PROPERTY's own DP_RINGAN saw zero PROPERTY ads
  });

  it("reports no top angle and an honest 'no data' reasoning when no ads have a classified angle", () => {
    const signal = CompetitorIntelService.interpretForStrategy([], "AUTOMOTIVE");
    expect(signal.topCompetitorAngle).toBeUndefined();
    expect(signal.reasoning).toContain("Tidak ada data");
  });

  it("picks the highest-count angle as topCompetitorAngle", () => {
    const ads = [
      makeAd({ angle: AdAngle.DP_RINGAN }),
      makeAd({ angle: AdAngle.DP_RINGAN }),
      makeAd({ angle: AdAngle.QNA }),
    ];
    const signal = CompetitorIntelService.interpretForStrategy(ads, "AUTOMOTIVE");
    expect(signal.topCompetitorAngle).toBe(AdAngle.DP_RINGAN);
  });
});
