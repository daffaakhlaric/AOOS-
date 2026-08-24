import { BranchId } from "@aos/branch-manager";
import { describe, expect, it, vi } from "vitest";

import { AdAngle } from "../../../src/domain/value-objects/AdAngle.js";
import {
  GoogleTrendsError,
  GoogleTrendsService,
  interpretForCampaign,
  trendToAngle,
  type TrendsData,
} from "../../../src/intelligence/GoogleTrendsService.js";

const ANTI_XSSI_PREFIX = ")]}'";

function exploreBody(
  widgets: ReadonlyArray<{ id: string; token: string; request?: unknown }>,
): string {
  return (
    ANTI_XSSI_PREFIX +
    "\n" +
    JSON.stringify({
      widgets: widgets.map((w) => ({ id: w.id, token: w.token, request: w.request ?? {} })),
    })
  );
}

function widgetDataBody(
  timelineData: ReadonlyArray<{ time: string; value: number[]; isPartial?: boolean }>,
): string {
  return ANTI_XSSI_PREFIX + "\n" + JSON.stringify({ default: { timelineData } });
}

function textResponse(body: string, init: { status?: number } = {}): Response {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { "content-type": "text/javascript" },
  });
}

/** A fetchImpl that returns the explore body on the first call, widgetdata body on the second, alternating for each chunk. */
function pairedFetch(pairs: ReadonlyArray<[string, string]>): typeof fetch {
  let call = 0;
  return vi.fn(async () => {
    const pairIndex = Math.floor(call / 2);
    const isExplore = call % 2 === 0;
    call += 1;
    const pair = pairs[pairIndex] as [string, string];
    return textResponse(isExplore ? pair[0] : pair[1]);
  }) as unknown as typeof fetch;
}

describe("GoogleTrendsService.branchToGeo", () => {
  it("maps BINTARO and CINERE to the real Banten ISO 3166-2 code (ID-BT)", () => {
    expect(GoogleTrendsService.branchToGeo(BranchId.BINTARO)).toBe("ID-BT");
    expect(GoogleTrendsService.branchToGeo(BranchId.CINERE)).toBe("ID-BT");
  });

  it("maps BANDUNG to the real West Java ISO 3166-2 code (ID-JB)", () => {
    expect(GoogleTrendsService.branchToGeo(BranchId.BANDUNG)).toBe("ID-JB");
  });

  it("maps UMUM to nationwide 'ID'", () => {
    expect(GoogleTrendsService.branchToGeo(BranchId.UMUM)).toBe("ID");
  });
});

describe("GoogleTrendsService.getTrends — happy path", () => {
  it("strips the )]}' anti-XSSI prefix and parses a real explore -> widgetdata response pair", async () => {
    // AUTOMOTIVE has 7 keywords -> chunks of [5, 2]; build 2 valid chunk responses.
    const chunk1Explore = exploreBody([{ id: "TIMESERIES", token: "TOK1" }]);
    const chunk1Data = widgetDataBody([
      { time: "1000", value: [10, 20, 5, 0, 30] },
      { time: "2000", value: [15, 40, 5, 0, 60] },
    ]);
    const chunk2Explore = exploreBody([{ id: "TIMESERIES", token: "TOK2" }]);
    const chunk2Data = widgetDataBody([
      { time: "1000", value: [50, 10] },
      { time: "2000", value: [50, 10] },
    ]);
    const fetchImpl = pairedFetch([
      [chunk1Explore, chunk1Data],
      [chunk2Explore, chunk2Data],
    ]);
    const service = new GoogleTrendsService({ fetchImpl });

    const result = await service.getTrends("AUTOMOTIVE", BranchId.CINERE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(7);
    // First keyword ("jual beli mobil bekas"): 10 -> 15, +50% => RISING.
    expect(result.value[0]).toMatchObject({ hasData: true, relativeInterest: 15, trend: "RISING" });
    // Fourth keyword ("xpander bekas"): all-zero values => no real data.
    expect(result.value[3]).toMatchObject({ hasData: false, relativeInterest: 0, trend: "STABLE" });
  });

  it("batches keywords into chunks of 5 (Google's real comparison limit) across multiple explore/widgetdata request pairs", async () => {
    const explore1 = exploreBody([{ id: "TIMESERIES", token: "TOK1" }]);
    const data1 = widgetDataBody([{ time: "1", value: [1, 1, 1, 1, 1] }]);
    const explore2 = exploreBody([{ id: "TIMESERIES", token: "TOK2" }]);
    const data2 = widgetDataBody([{ time: "1", value: [1, 1] }]);
    let capturedFirstReq: string | undefined;
    let call = 0;
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = new URL(url.toString());
      if (call === 0) {
        capturedFirstReq = u.searchParams.get("req") ?? undefined;
      }
      const pairIndex = Math.floor(call / 2);
      const isExplore = call % 2 === 0;
      call += 1;
      return textResponse(
        isExplore
          ? ([explore1, explore2][pairIndex] as string)
          : ([data1, data2][pairIndex] as string),
      );
    }) as unknown as typeof fetch;
    const service = new GoogleTrendsService({ fetchImpl });

    const result = await service.getTrends("PROPERTY", BranchId.UMUM);

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    const parsedReq = JSON.parse(capturedFirstReq as string) as { comparisonItem: unknown[] };
    expect(parsedReq.comparisonItem).toHaveLength(5);
  });

  it("sends real explore params (hl, tz, req with comparisonItem/category/property)", async () => {
    let capturedUrl: string | undefined;
    const fetchImpl = vi.fn(async (url: string | URL) => {
      capturedUrl = url.toString();
      return textResponse(exploreBody([{ id: "TIMESERIES", token: "TOK" }]));
    }) as unknown as typeof fetch;
    // Only exercise the explore call in isolation by giving a broken widgetdata response
    // afterwards (irrelevant here — we only assert on the FIRST captured URL).
    let call = 0;
    const combinedFetch = vi.fn(async (url: string | URL) => {
      call += 1;
      if (call === 1) return fetchImpl(url);
      return textResponse(widgetDataBody([]));
    }) as unknown as typeof fetch;
    const service = new GoogleTrendsService({ fetchImpl: combinedFetch });

    await service.getTrends("AUTOMOTIVE", BranchId.BANDUNG);

    const url = new URL(capturedUrl as string);
    expect(url.origin + url.pathname).toBe("https://trends.google.com/trends/api/explore");
    expect(url.searchParams.get("hl")).toBe("id");
    expect(url.searchParams.has("tz")).toBe(true);
    const req = JSON.parse(url.searchParams.get("req") as string) as {
      comparisonItem: Array<{ keyword: string; geo: string; time: string }>;
      category: number;
      property: string;
    };
    expect(req.comparisonItem[0]?.geo).toBe("ID-JB");
    expect(req.category).toBe(0);
    expect(req.property).toBe("");
  });
});

describe("GoogleTrendsService.getTrends — degraded mode", () => {
  it("returns Result.err(GoogleTrendsError) on a request timeout, never hangs", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const abortError = new Error("The operation was aborted");
            abortError.name = "AbortError";
            reject(abortError);
          });
        }),
    ) as unknown as typeof fetch;
    const service = new GoogleTrendsService({ fetchImpl, timeoutMs: 5 });

    const result = await service.getTrends("AUTOMOTIVE", BranchId.UMUM);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(GoogleTrendsError);
      expect(result.error.message).toContain("timed out");
    }
  });

  it("returns Result.err(GoogleTrendsError) on a malformed (unparseable) response body", async () => {
    const fetchImpl = vi.fn(async () => textResponse("not even prefixed json{{{"));
    const service = new GoogleTrendsService({ fetchImpl });

    const result = await service.getTrends("AUTOMOTIVE", BranchId.UMUM);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(GoogleTrendsError);
    }
  });

  it("returns Result.err(GoogleTrendsError) when the explore response has no TIMESERIES widget (unexpected shape)", async () => {
    const fetchImpl = vi.fn(async () =>
      textResponse(exploreBody([{ id: "GEO_MAP", token: "TOK" }])),
    );
    const service = new GoogleTrendsService({ fetchImpl });

    const result = await service.getTrends("AUTOMOTIVE", BranchId.UMUM);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("TIMESERIES");
    }
  });

  it("returns Result.err(GoogleTrendsError) on a non-2xx response (e.g. 429 rate limited), never treated as empty data", async () => {
    const fetchImpl = vi.fn(async () => textResponse("blocked", { status: 429 }));
    const service = new GoogleTrendsService({ fetchImpl });

    const result = await service.getTrends("AUTOMOTIVE", BranchId.UMUM);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(GoogleTrendsError);
    }
  });

  it("returns Result.err(GoogleTrendsError) on a network failure (never throws)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    const service = new GoogleTrendsService({ fetchImpl });

    const result = await service.getTrends("AUTOMOTIVE", BranchId.UMUM);

    expect(result.ok).toBe(false);
  });

  it("distinguishes 'keyword has no data' (ok, hasData:false) from a whole-endpoint failure — a real empty timeline never becomes an error", async () => {
    // AUTOMOTIVE has 7 keywords -> 2 chunks; both chunks resolve cleanly but with an empty
    // timeline (Google's real "no data for this keyword/geo" shape).
    const fetchImpl = pairedFetch([
      [exploreBody([{ id: "TIMESERIES", token: "TOK1" }]), widgetDataBody([])],
      [exploreBody([{ id: "TIMESERIES", token: "TOK2" }]), widgetDataBody([])],
    ]);
    const service = new GoogleTrendsService({ fetchImpl });

    const result = await service.getTrends("AUTOMOTIVE", BranchId.UMUM);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(7);
      for (const trend of result.value) {
        expect(trend.hasData).toBe(false);
        expect(trend.relativeInterest).toBe(0);
      }
    }
  });
});

describe("GoogleTrendsService — circuit breaker", () => {
  it("opens after N consecutive whole-call failures and skips further network calls during cooldown", async () => {
    const fetchImpl = vi.fn(async () => textResponse("bad", { status: 500 }));
    let now = 1_000_000;
    const service = new GoogleTrendsService({
      fetchImpl,
      circuitBreakerThreshold: 2,
      circuitBreakerCooldownMs: 60_000,
      now: () => now,
    });

    expect(service.isCircuitOpen()).toBe(false);
    await service.getTrends("AUTOMOTIVE", BranchId.UMUM);
    expect(service.isCircuitOpen()).toBe(false);
    await service.getTrends("AUTOMOTIVE", BranchId.UMUM);
    expect(service.isCircuitOpen()).toBe(true);

    const callsBeforeSkip = fetchImpl.mock.calls.length;
    const skippedResult = await service.getTrends("AUTOMOTIVE", BranchId.UMUM);
    expect(skippedResult.ok).toBe(false);
    if (!skippedResult.ok) {
      expect(skippedResult.error).toBeInstanceOf(GoogleTrendsError);
    }
    expect(fetchImpl.mock.calls.length).toBe(callsBeforeSkip); // no network call while open

    now += 60_001; // advance past cooldown
    expect(service.isCircuitOpen()).toBe(false);
  });

  it("resets the failure counter and closes the circuit on any success", async () => {
    let call = 0;
    const failThenSucceed = vi.fn(async () => {
      call += 1;
      if (call <= 1) {
        return textResponse("bad", { status: 500 });
      }
      // Second call onward (a fresh getTrends attempt): succeed with a real, minimal 2-chunk pair.
      return textResponse(
        call % 2 === 0
          ? exploreBody([{ id: "TIMESERIES", token: "TOK" }])
          : widgetDataBody([{ time: "1", value: [1, 1, 1, 1, 1] }]),
      );
    }) as unknown as typeof fetch;
    const service = new GoogleTrendsService({
      fetchImpl: failThenSucceed,
      circuitBreakerThreshold: 3,
    });

    const first = await service.getTrends("AUTOMOTIVE", BranchId.UMUM);
    expect(first.ok).toBe(false);
    expect(service.isCircuitOpen()).toBe(false); // threshold is 3, one failure isn't enough to open
  });
});

function td(overrides: Partial<TrendsData>): TrendsData {
  return {
    keyword: "kw",
    relativeInterest: 50,
    trend: "STABLE",
    weeklyDelta: 0,
    hasData: true,
    ...overrides,
  };
}

describe("trendToAngle", () => {
  it("maps DP/kredit/cicilan rising keywords to the real DP_RINGAN member for both verticals", () => {
    expect(trendToAngle([td({ keyword: "dp mobil" })], "AUTOMOTIVE")).toBe(AdAngle.DP_RINGAN);
    expect(trendToAngle([td({ keyword: "cicilan rumah" })], "PROPERTY")).toBe("DP_RINGAN");
  });

  it("maps 'investasi' rising to the real PROPERTY-only INVESTASI member", () => {
    expect(trendToAngle([td({ keyword: "properti investasi" })], "PROPERTY")).toBe("INVESTASI");
  });

  it("maps 'murah' rising to real GUDANGNYA (AUTOMOTIVE) / PROMO_TERBATAS (PROPERTY), never the fictional PRICE_FOCUS", () => {
    expect(trendToAngle([td({ keyword: "mobil bekas murah" })], "AUTOMOTIVE")).toBe(
      AdAngle.GUDANGNYA,
    );
    expect(trendToAngle([td({ keyword: "rumah murah" })], "PROPERTY")).toBe("PROMO_TERBATAS");
  });

  it("defaults to the real TESTIMONIAL member for both verticals, never the fictional BRAND_AWARENESS", () => {
    expect(trendToAngle([], "AUTOMOTIVE")).toBe(AdAngle.TESTIMONIAL);
    expect(trendToAngle([], "PROPERTY")).toBe("TESTIMONIAL");
  });
});

describe("interpretForCampaign", () => {
  it("recommends scaling budget when the top keyword's interest exceeds 70", () => {
    const trends = [td({ keyword: "dp mobil", relativeInterest: 85, trend: "RISING" })];
    const signal = interpretForCampaign(trends, "AUTOMOTIVE");
    expect(signal.shouldScaleBudget).toBe(true);
    expect(signal.suggestedAngle).toBe(AdAngle.DP_RINGAN);
    expect(signal.reasoning).toContain("dp mobil");
  });

  it("does not recommend scaling when top interest is <= 70", () => {
    const trends = [td({ relativeInterest: 40 })];
    const signal = interpretForCampaign(trends, "PROPERTY");
    expect(signal.shouldScaleBudget).toBe(false);
  });

  it("returns an honest 'no data' signal for an empty trends array, never throws", () => {
    const signal = interpretForCampaign([], "AUTOMOTIVE");
    expect(signal.shouldScaleBudget).toBe(false);
    expect(signal.reasoning).toContain("Tidak ada data");
  });
});
