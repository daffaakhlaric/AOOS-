import { Branch } from "@aos/meta-ads-connector";

import { ScrapedUnit, type Transmission } from "../../src/domain/entities/ScrapedUnit.js";
import { ScrapedKilometer } from "../../src/domain/value-objects/ScrapedKilometer.js";
import { ScrapedPrice } from "../../src/domain/value-objects/ScrapedPrice.js";
import { ScrapeTimestamp } from "../../src/domain/value-objects/ScrapeTimestamp.js";
import { UnitUrl } from "../../src/domain/value-objects/UnitUrl.js";

export interface UnitOverrides {
  readonly slug?: string;
  readonly brand?: string;
  readonly model?: string;
  readonly year?: number;
  readonly transmission?: Transmission;
  readonly color?: string;
  readonly kilometer?: number;
  readonly priceIdr?: number;
  readonly branch?: Branch;
  readonly photos?: readonly string[];
  readonly available?: boolean;
  readonly scrapedAt?: Date;
}

/** Builds a real `ScrapedUnit` (through the real VO/entity validators) with sensible defaults. */
export function makeUnit(overrides: UnitOverrides = {}): ScrapedUnit {
  const url = UnitUrl.create(`https://mobixbydss.id/unit/${overrides.slug ?? "brio-rs-2021"}`);
  const km = ScrapedKilometer.create(overrides.kilometer ?? 32_000);
  const price = ScrapedPrice.create(overrides.priceIdr ?? 145_000_000);
  const scrapedAt = ScrapeTimestamp.create(
    overrides.scrapedAt ?? new Date("2026-08-14T07:32:00.000Z"),
  );
  if (!url.ok || !km.ok || !price.ok || !scrapedAt.ok) {
    throw new Error("makeUnit fixture setup failed");
  }
  const result = ScrapedUnit.create({
    url: url.value,
    model: overrides.model ?? "Brio RS",
    brand: overrides.brand ?? "Honda",
    year: overrides.year ?? 2021,
    transmission: overrides.transmission ?? "MT",
    color: overrides.color ?? "Merah",
    kilometer: km.value,
    price: price.value,
    branch: overrides.branch ?? Branch.BINTARO,
    photos: overrides.photos ?? ["https://cdn.mobixbydss.id/brio/1.jpg"],
    available: overrides.available ?? true,
    scrapedAt: scrapedAt.value,
  });
  if (!result.ok) {
    throw new Error(`makeUnit fixture setup failed: ${result.error.message}`);
  }
  return result.value;
}
