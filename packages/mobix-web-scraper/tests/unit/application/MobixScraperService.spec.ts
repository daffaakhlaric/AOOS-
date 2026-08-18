import { err, ok } from "@aos/common";
import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import { MobixScraperService } from "../../../src/application/services/MobixScraperService.js";
import { DetectInventoryChanges } from "../../../src/application/use-cases/DetectInventoryChanges.js";
import type {
  RunFullScrape,
  RunFullScrapeResult,
} from "../../../src/application/use-cases/RunFullScrape.js";
import type { ScrapeInventory } from "../../../src/application/use-cases/ScrapeInventory.js";
import type { ScrapePromos } from "../../../src/application/use-cases/ScrapePromos.js";
import { ScrapedUnit } from "../../../src/domain/entities/ScrapedUnit.js";
import { ScrapeSession } from "../../../src/domain/entities/ScrapeSession.js";
import { ScrapeError } from "../../../src/domain/errors/ScrapeError.js";
import { MobixScraperEvents } from "../../../src/domain/events/MobixScraperEvents.js";
import { ScrapedKilometer } from "../../../src/domain/value-objects/ScrapedKilometer.js";
import { ScrapedPrice } from "../../../src/domain/value-objects/ScrapedPrice.js";
import { ScrapeTimestamp } from "../../../src/domain/value-objects/ScrapeTimestamp.js";
import { UnitUrl } from "../../../src/domain/value-objects/UnitUrl.js";
import { createFakePublisher } from "../../helpers/publisher.js";

const clock = () => new Date("2026-08-07T00:00:00.000Z");

function makeUnit(slug: string): ScrapedUnit {
  const url = UnitUrl.create(`https://mobixbydss.id/unit/${slug}`);
  const km = ScrapedKilometer.create(1000);
  const price = ScrapedPrice.create(100_000_000);
  if (!url.ok || !km.ok || !price.ok) throw new Error("fixture setup failed");
  const result = ScrapedUnit.create({
    url: url.value,
    model: "Brio",
    brand: "Honda",
    year: 2020,
    transmission: "AT",
    color: "Merah",
    kilometer: km.value,
    price: price.value,
    branch: Branch.CINERE,
    photos: [],
    available: true,
    scrapedAt: ScrapeTimestamp.now(clock),
  });
  if (!result.ok) throw new Error("fixture setup failed");
  return result.value;
}

function makeSession(sessionId: string, units: ScrapedUnit[]): ScrapeSession {
  const result = ScrapeSession.create({
    sessionId,
    units,
    startedAt: clock(),
    completedAt: clock(),
    sourceUrl: "https://mobixbydss.id/unit",
  });
  if (!result.ok) throw new Error("fixture setup failed");
  return result.value;
}

describe("MobixScraperService", () => {
  it("scrapeInventoryUnits() delegates to ScrapeInventory and remembers the session", async () => {
    const session = makeSession("s1", [makeUnit("brio-1")]);
    const scrapeInventory = {
      execute: vi.fn(async () => ok(session)),
    } as unknown as ScrapeInventory;
    const scrapePromos = { execute: vi.fn() } as unknown as ScrapePromos;
    const publisher = createFakePublisher();
    const detect = new DetectInventoryChanges(new MobixScraperEvents(publisher), clock);
    const service = new MobixScraperService(scrapeInventory, scrapePromos, detect);

    const result = await service.scrapeInventoryUnits();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(1);
    expect(service.lastScrapedSession?.sessionId).toBe("s1");
  });

  it("scrapeInventoryUnits() propagates a failure without updating lastScrapedSession", async () => {
    const scrapeInventory = {
      execute: vi.fn(async () => err(new ScrapeError("boom"))),
    } as unknown as ScrapeInventory;
    const scrapePromos = { execute: vi.fn() } as unknown as ScrapePromos;
    const publisher = createFakePublisher();
    const detect = new DetectInventoryChanges(new MobixScraperEvents(publisher), clock);
    const service = new MobixScraperService(scrapeInventory, scrapePromos, detect);

    const result = await service.scrapeInventoryUnits();

    expect(result.ok).toBe(false);
    expect(service.lastScrapedSession).toBeUndefined();
  });

  it("scrapePromosList() delegates to ScrapePromos", async () => {
    const scrapeInventory = { execute: vi.fn() } as unknown as ScrapeInventory;
    const scrapePromos = { execute: vi.fn(async () => ok([])) } as unknown as ScrapePromos;
    const publisher = createFakePublisher();
    const detect = new DetectInventoryChanges(new MobixScraperEvents(publisher), clock);
    const service = new MobixScraperService(scrapeInventory, scrapePromos, detect);

    const result = await service.scrapePromosList();

    expect(result.ok).toBe(true);
  });

  it("detectChanges() diffs against the last remembered session and updates it", async () => {
    const first = makeSession("s1", [makeUnit("brio-1")]);
    const second = makeSession("s2", [makeUnit("brio-1"), makeUnit("brio-2")]);
    const scrapeInventory = {
      execute: vi.fn().mockResolvedValueOnce(ok(first)),
    } as unknown as ScrapeInventory;
    const scrapePromos = { execute: vi.fn() } as unknown as ScrapePromos;
    const publisher = createFakePublisher();
    const detect = new DetectInventoryChanges(new MobixScraperEvents(publisher), clock);
    const service = new MobixScraperService(scrapeInventory, scrapePromos, detect);

    await service.scrapeInventoryUnits();
    const diff = await service.detectChanges(second);

    expect(diff.ok).toBe(true);
    if (diff.ok) {
      expect(diff.value.newUnits.map((u) => u.identityKey)).toEqual(["brio-2"]);
    }
    expect(service.lastScrapedSession?.sessionId).toBe("s2");
  });

  it("runFullScrape() returns a ScrapeError when the factory did not compose a RunFullScrape use case", async () => {
    const scrapeInventory = { execute: vi.fn() } as unknown as ScrapeInventory;
    const scrapePromos = { execute: vi.fn() } as unknown as ScrapePromos;
    const publisher = createFakePublisher();
    const detect = new DetectInventoryChanges(new MobixScraperEvents(publisher), clock);
    const service = new MobixScraperService(scrapeInventory, scrapePromos, detect);

    const result = await service.runFullScrape();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/not composed with a RunFullScrape/);
    }
  });

  it("runFullScrape() delegates to RunFullScrape with the remembered lastScrapedSession and updates it", async () => {
    const first = makeSession("s1", [makeUnit("brio-1")]);
    const fullScrapeResult: RunFullScrapeResult = {
      session: makeSession("s2", [makeUnit("brio-1"), makeUnit("brio-2")]),
      diff: { newUnits: [makeUnit("brio-2")], soldUnits: [], unchangedCount: 1 },
      photoResults: [],
    };
    const fullScrapeExecute = vi.fn(async () => ok(fullScrapeResult));
    const fullScrape = { execute: fullScrapeExecute } as unknown as RunFullScrape;

    const scrapeInventory = {
      execute: vi.fn(async () => ok(first)),
    } as unknown as ScrapeInventory;
    const scrapePromos = { execute: vi.fn() } as unknown as ScrapePromos;
    const publisher = createFakePublisher();
    const detect = new DetectInventoryChanges(new MobixScraperEvents(publisher), clock);
    const service = new MobixScraperService(scrapeInventory, scrapePromos, detect, fullScrape);

    await service.scrapeInventoryUnits();
    const result = await service.runFullScrape("corr-99");

    // Third argument is the AAOS-SCRAPER-ASSET-LIBRARY `onProgress` listener — `undefined` here
    // because this caller didn't pass one.
    expect(fullScrapeExecute).toHaveBeenCalledWith(first, "corr-99", undefined);
    expect(result.ok).toBe(true);
    expect(service.lastScrapedSession?.sessionId).toBe("s2");
  });

  it("runFullScrape() propagates a failure without updating lastScrapedSession", async () => {
    const fullScrapeExecute = vi.fn(async () => err(new ScrapeError("scrape boom")));
    const fullScrape = { execute: fullScrapeExecute } as unknown as RunFullScrape;
    const scrapeInventory = { execute: vi.fn() } as unknown as ScrapeInventory;
    const scrapePromos = { execute: vi.fn() } as unknown as ScrapePromos;
    const publisher = createFakePublisher();
    const detect = new DetectInventoryChanges(new MobixScraperEvents(publisher), clock);
    const service = new MobixScraperService(scrapeInventory, scrapePromos, detect, fullScrape);

    const result = await service.runFullScrape();

    expect(result.ok).toBe(false);
    expect(service.lastScrapedSession).toBeUndefined();
  });
});
