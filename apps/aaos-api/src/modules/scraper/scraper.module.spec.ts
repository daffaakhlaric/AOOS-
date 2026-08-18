import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { ScrapeJobRepository } from "./infrastructure/scrape-job.repository.js";
import { ScraperController } from "./scraper.controller.js";
import { ScraperModule } from "./scraper.module.js";
import { ScraperService } from "./scraper.service.js";

type FactoryProvider = {
  provide?: unknown;
  useFactory?: (...args: never[]) => unknown;
  inject?: unknown[];
};

describe("ScraperModule", () => {
  it("registers ScraperController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", ScraperModule) as unknown[];
    expect(metadata).toEqual([ScraperController]);
  });

  it("registers ScraperService and ApiKeyGuard as class providers", () => {
    const metadata = Reflect.getMetadata("providers", ScraperModule) as unknown[];
    expect(metadata).toContain(ScraperService);
    expect(metadata).toContain(ApiKeyGuard);
  });

  it("provides ScrapeJobRepository from the SHARED SUPABASE_CLIENT (not a second connection)", () => {
    const metadata = Reflect.getMetadata("providers", ScraperModule) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === ScrapeJobRepository);
    expect(provider).toBeDefined();
    expect(provider?.inject).toEqual([SUPABASE_CLIENT]);
    const fakeClient = { from: () => undefined, channel: () => undefined } as never;
    expect(provider?.useFactory?.(fakeClient)).toBeInstanceOf(ScrapeJobRepository);
  });
});
