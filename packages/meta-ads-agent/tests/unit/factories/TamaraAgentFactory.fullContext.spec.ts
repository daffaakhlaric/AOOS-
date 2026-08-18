import { AdAccountId, MetaApiError } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import type { ExecuteVerdictPort } from "../../../src/application/services/ExecutionService.js";
import type { PullCampaignDataPort } from "../../../src/application/services/HistoricalLearningService.js";
import { DEFAULT_META_ADS_AGENT_CONFIG } from "../../../src/config/MetaAdsAgentConfig.js";
import { TamaraAgentFactory } from "../../../src/factories/TamaraAgentFactory.js";
import { buildLargeAdAccount } from "../../fixtures/adAccountFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";

const AD_ACCOUNT_ID = AdAccountId.create("act_752604553578354");
if (!AD_ACCOUNT_ID.ok) throw new Error("fixture setup failed");

function fakeExecuteVerdict(): ExecuteVerdictPort {
  return {
    execute: vi.fn().mockResolvedValue({
      ok: true,
      value: { action: "PAUSED", targetId: "ad-1", targetType: "ad" },
    }),
  };
}

function fakeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never;
}

function baseOptions() {
  return {
    config: { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG },
    publisher: createFakePublisher(),
    executeVerdict: fakeExecuteVerdict() as never,
    metaAccessToken: "token",
    adAccountId: AD_ACCOUNT_ID.value,
    logger: fakeLogger(),
    now: () => new Date("2026-08-09T00:00:00.000Z"),
  };
}

function pullSuccess(): PullCampaignDataPort {
  return { execute: vi.fn().mockResolvedValue({ ok: true, value: buildLargeAdAccount() }) };
}

function pullFailure(): PullCampaignDataPort {
  return {
    execute: vi.fn().mockResolvedValue({ ok: false, error: new MetaApiError("meta api down") }),
  };
}

/**
 * A `fetch`-shaped stub returning a 200-OK HTML page for every request.
 *
 * Inventory now comes from mobixbydss.id's real JSON API (`POST /api/get-all-produk`), so an HTML
 * body makes `MobixInventoryScraper` fail at JSON decoding; the promo page is still real HTML, and
 * `PromoParser` treats "zero promo-card blocks" as a `ParseError`. Either way this deterministically
 * drives the S2 FAILURE path (real network success, real decode/parse failure — a realistic "the
 * endpoint is serving an error page" scenario). A fresh `Response` is constructed per call since the
 * body of a given instance can only be read once.
 */
function fetchOkButUnparseable(): typeof fetch {
  return vi.fn(
    async () => new Response("<html><body>no data yet</body></html>", { status: 200 }),
  ) as never;
}

/**
 * A `fetch`-shaped stub returning REAL data on both S2 paths — a genuine `/api/get-all-produk` JSON
 * response (shaped exactly like the live API, including `meta.total_pages`) for inventory, and real
 * `promo-card` HTML for promos. Drives a genuine S2 SUCCESS with one real unit and one real promo.
 */
function fetchOkWithRealData(): typeof fetch {
  const listingJson = {
    status: "success",
    code: 200,
    error: "",
    message: "Data berhasil ditemukan",
    data: [
      {
        cabang: "BINTARO",
        color: "Putih",
        harga: 195000000,
        merek: "Mitsubishi",
        nama: "Mitsubishi Xpander Cross 2019 Putih",
        odometer: 45000,
        slug: "xpander-cross-2019-abc123",
        transmisi: "AUTOMATIC",
        type: "Xpander Cross",
        year: 2019,
      },
    ],
    meta: { limit: 12, page: 1, total_data: 1, total_pages: 1 },
  };
  const promoHtml = `<html><body><div class="promo-listing">
  <section class="promo-card">
    <h3 class="promo-card__title">DP Ringan Mulai 10 Juta</h3>
    <p class="promo-card__desc">Simulasi kredit transparan</p>
  </section>
</div></body></html>`;
  return vi.fn(async (url: RequestInfo | URL) => {
    if (String(url).includes("promo")) {
      return new Response(promoHtml, { status: 200 });
    }
    return new Response(JSON.stringify(listingJson), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as never;
}

/** A `fetch`-shaped stub that always rejects — simulates a network-level scrape failure. */
function fetchFailing(): typeof fetch {
  return vi.fn().mockRejectedValue(new Error("network unreachable")) as never;
}

describe("TamaraAgentFactory.createWithFullContext", () => {
  it("both S1 + S2 succeed: seeds AgentMemory with REAL historical + inventory + promo data (not the fallback)", async () => {
    const result = await TamaraAgentFactory.createWithFullContext({
      ...baseOptions(),
      pullCampaignData: pullSuccess(),
      mobixScraperOptions: { fetchImpl: fetchOkWithRealData() },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const memory = result.value.tamaraAgentService.getMemory();
    expect(memory.historicalLearned).toBe(true);
    expect(memory.inventoryLoaded).toBe(true);
    expect(memory.currentInventory).toHaveLength(1);
    expect(memory.currentInventory[0]?.model).toBe("Xpander Cross");
    expect(memory.activePromos).toHaveLength(1);
    expect(memory.activePromos[0]?.title).toBe("DP Ringan Mulai 10 Juta");
  });

  it("runs S1 (PullCampaignData) and S2 (scrape) in parallel via Promise.all", async () => {
    const events: string[] = [];
    const pull: PullCampaignDataPort = {
      execute: vi.fn(async () => {
        events.push("s1-start");
        await new Promise((r) => setTimeout(r, 10));
        events.push("s1-end");
        return { ok: true, value: buildLargeAdAccount() };
      }),
    };
    const fetchImpl = vi.fn(async () => {
      events.push("s2-start");
      await new Promise((r) => setTimeout(r, 5));
      events.push("s2-end");
      return new Response("<html></html>", { status: 200 });
    }) as unknown as typeof fetch;

    await TamaraAgentFactory.createWithFullContext({
      ...baseOptions(),
      pullCampaignData: pull,
      mobixScraperOptions: { fetchImpl },
    });

    // If S1/S2 ran sequentially, s1-end would always precede s2-start. Parallel execution means
    // s2-start happens before s1-end (S2's shorter delay finishes first).
    expect(events.indexOf("s2-start")).toBeLessThan(events.indexOf("s1-end"));
  });

  it("S1 fails, S2 succeeds: falls back to KNOWN_FATIGUE_PATTERNS, still seeds REAL inventory", async () => {
    const result = await TamaraAgentFactory.createWithFullContext({
      ...baseOptions(),
      pullCampaignData: pullFailure(),
      mobixScraperOptions: { fetchImpl: fetchOkWithRealData() },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const memory = result.value.tamaraAgentService.getMemory();
    expect(memory.historicalLearned).toBe(true); // seeded from KNOWN_* fallback
    expect(memory.fatiguePatterns.size).toBeGreaterThan(0); // KNOWN_FATIGUE_PATTERNS has 4 entries
    expect(memory.inventoryLoaded).toBe(true);
    expect(memory.currentInventory).toHaveLength(1); // real S2 data, not the empty fallback
    expect(memory.activePromos).toHaveLength(1);
  });

  it("S1 fails, S2 also fails to PARSE (200 OK but no recognizable cards): falls back to empty inventory too", async () => {
    const result = await TamaraAgentFactory.createWithFullContext({
      ...baseOptions(),
      pullCampaignData: pullFailure(),
      mobixScraperOptions: { fetchImpl: fetchOkButUnparseable() },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const memory = result.value.tamaraAgentService.getMemory();
    expect(memory.currentInventory).toHaveLength(0);
    expect(memory.activePromos).toHaveLength(0);
  });

  it("S1 succeeds, S2 fails: falls back to empty inventory/promos, still seeds real historical learnings", async () => {
    const result = await TamaraAgentFactory.createWithFullContext({
      ...baseOptions(),
      pullCampaignData: pullSuccess(),
      mobixScraperOptions: { fetchImpl: fetchFailing() },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const memory = result.value.tamaraAgentService.getMemory();
    expect(memory.historicalLearned).toBe(true);
    expect(memory.inventoryLoaded).toBe(true);
    expect(memory.currentInventory).toHaveLength(0);
    expect(memory.activePromos).toHaveLength(0);
  });

  it("both S1 + S2 fail: still returns a usable agent seeded from static Mobix knowledge alone", async () => {
    const result = await TamaraAgentFactory.createWithFullContext({
      ...baseOptions(),
      pullCampaignData: pullFailure(),
      mobixScraperOptions: { fetchImpl: fetchFailing() },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const memory = result.value.tamaraAgentService.getMemory();
    expect(memory.historicalLearned).toBe(true);
    expect(memory.fatiguePatterns.size).toBeGreaterThan(0);
    expect(memory.inventoryLoaded).toBe(true);
    expect(memory.currentInventory).toHaveLength(0);
    // The runtime itself must still be fully usable.
    expect(result.value.runOptimizationCycle).toBeDefined();
    expect(result.value.generateDailyDigest).toBeDefined();
  });

  it("defaults scrapeInventory to true and historicalDays to 90", async () => {
    const pull = pullSuccess();
    const result = await TamaraAgentFactory.createWithFullContext({
      ...baseOptions(),
      pullCampaignData: pull,
      mobixScraperOptions: { fetchImpl: fetchOkButUnparseable() },
    });
    expect(result.ok).toBe(true);
    // learn() is always called with datePreset last_30d regardless — verified via HistoricalLearningService's own spec.
    expect(pull.execute).toHaveBeenCalled();
  });

  it("uses a default logger/clock when none are supplied", async () => {
    const result = await TamaraAgentFactory.createWithFullContext({
      config: { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG },
      publisher: createFakePublisher(),
      executeVerdict: fakeExecuteVerdict() as never,
      metaAccessToken: "token",
      adAccountId: AD_ACCOUNT_ID.value,
      pullCampaignData: pullSuccess(),
      mobixScraperOptions: { fetchImpl: fetchOkButUnparseable() },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tamaraAgentService.getMemory().lastInventoryScrapeAt).toBeInstanceOf(Date);
  });

  it("returns Result.err for a structurally invalid config (empty tenantId) — never seeds anything", async () => {
    const result = await TamaraAgentFactory.createWithFullContext({
      ...baseOptions(),
      config: { tenantId: "", ...DEFAULT_META_ADS_AGENT_CONFIG },
      pullCampaignData: pullSuccess(),
      mobixScraperOptions: { fetchImpl: fetchOkButUnparseable() },
    });
    expect(result.ok).toBe(false);
  });

  it("forwards mobixScraperOptions (e.g. a custom listingUrl) to MobixScraperFactory.create", async () => {
    const requestedUrls: string[] = [];
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      requestedUrls.push(String(url));
      return new Response("<html></html>", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await TamaraAgentFactory.createWithFullContext({
      ...baseOptions(),
      pullCampaignData: pullSuccess(),
      mobixScraperOptions: { fetchImpl, listingUrl: "https://custom.example/units" },
    });
    expect(result.ok).toBe(true);
    // The inventory scraper derives the real JSON API endpoint from the custom listingUrl's ORIGIN.
    expect(requestedUrls).toContain("https://custom.example/api/get-all-produk");
  });

  it("historicalDays: 30 does not trigger HistoricalLearningService's non-30-days warning", async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const result = await TamaraAgentFactory.createWithFullContext({
      ...baseOptions(),
      logger: logger as never,
      historicalDays: 30,
      pullCampaignData: pullSuccess(),
      mobixScraperOptions: { fetchImpl: fetchOkButUnparseable() },
    });
    expect(result.ok).toBe(true);
    expect(
      logger.warn.mock.calls.some((call) => String(call[1] ?? "").includes("cannot natively pull")),
    ).toBe(false);
  });

  it("scrapeInventory: false skips the S2 network calls entirely, seeding empty inventory/promos", async () => {
    const fetchImpl = fetchOkButUnparseable();
    const result = await TamaraAgentFactory.createWithFullContext({
      ...baseOptions(),
      pullCampaignData: pullSuccess(),
      scrapeInventory: false,
      mobixScraperOptions: { fetchImpl },
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
    if (!result.ok) return;
    expect(result.value.tamaraAgentService.getMemory().currentInventory).toHaveLength(0);
  });
});
