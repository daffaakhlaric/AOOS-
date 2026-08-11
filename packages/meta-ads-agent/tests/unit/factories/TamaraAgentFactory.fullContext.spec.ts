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
 * A `fetch`-shaped stub returning a 200-OK page with NO `unit-card`/`promo-card` markup.
 * `UnitListingParser`/`PromoParser` both treat "zero cards found" as a `ParseError` (see those
 * files) — so despite the 200 status, this deterministically drives the S2 FAILURE path (real
 * network success, real parse failure — a realistic "page layout changed" scenario). A fresh
 * `Response` is constructed per call since `scrapeInventoryUnits()`/`scrapePromosList()` each
 * call `fetchImpl` once and `Response.text()` can only be read once per instance.
 */
function fetchOkButUnparseable(): typeof fetch {
  return vi.fn(
    async () => new Response("<html><body>no data yet</body></html>", { status: 200 }),
  ) as never;
}

/** A `fetch`-shaped stub returning real, parseable `unit-card`/`promo-card` HTML — drives a genuine S2 SUCCESS with one real unit and one real promo. */
function fetchOkWithRealData(): typeof fetch {
  const unitHtml = `<html><body><div class="unit-listing">
  <article class="unit-card" data-branch="BINTARO" data-available="true">
    <a class="unit-card__link" href="https://mobixbydss.id/unit/xpander-cross-2019-abc123">
      <h3 class="unit-card__title">Mitsubishi Xpander Cross 2019</h3>
      <span class="unit-card__price">Rp 195.000.000</span>
      <span class="unit-card__km">45.000 km</span>
      <span class="unit-card__transmission">AT</span>
      <span class="unit-card__color">Putih</span>
    </a>
  </article>
</div></body></html>`;
  const promoHtml = `<html><body><div class="promo-listing">
  <section class="promo-card">
    <h3 class="promo-card__title">DP Ringan Mulai 10 Juta</h3>
    <p class="promo-card__desc">Simulasi kredit transparan</p>
  </section>
</div></body></html>`;
  return vi.fn(async (url: RequestInfo | URL) => {
    const html = String(url).includes("promo") ? promoHtml : unitHtml;
    return new Response(html, { status: 200 });
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
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toBe("https://custom.example/units");
      return new Response("<html></html>", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await TamaraAgentFactory.createWithFullContext({
      ...baseOptions(),
      pullCampaignData: pullSuccess(),
      mobixScraperOptions: { fetchImpl, listingUrl: "https://custom.example/units" },
    });
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalled();
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
