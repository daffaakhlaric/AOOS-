import { err, ok, type Result } from "@aos/common";
import { Branch } from "@aos/meta-ads-connector";

import { ScrapedUnit, type Transmission } from "../../domain/entities/ScrapedUnit.js";
import { ParseError } from "../../domain/errors/ParseError.js";
import type { ScrapeWarningListener } from "../../domain/events/ScrapeWarning.js";
import { normalizeCabang } from "../../domain/value-objects/normalizeCabang.js";
import { ScrapedKilometer } from "../../domain/value-objects/ScrapedKilometer.js";
import { ScrapedPrice } from "../../domain/value-objects/ScrapedPrice.js";
import { ScrapeTimestamp } from "../../domain/value-objects/ScrapeTimestamp.js";
import { UnitUrl } from "../../domain/value-objects/UnitUrl.js";

import { mobixListingItemSchema, type MobixListingItem } from "./MobixApiSchemas.js";

/**
 * Public unit-detail page path on mobixbydss.id. Inferred from `/produk` being the listing route
 * plus the API's own `slug` field — chosen because `ScrapedUnit.identityKey` is `UnitUrl.slug` (the
 * last path segment), so `"/produk/" + item.slug` round-trips back to exactly `item.slug`. Whether
 * the page itself renders is irrelevant to scraping: nothing in this package fetches it, it only
 * gives each unit a stable, real identity.
 */
export const UNIT_PATH_PREFIX = "/produk/";

/**
 * mobixbydss.id returns photo paths as site-relative `/unit-file-serve?path=…` strings, never
 * absolute URLs — both the listing's `thumbnail`/`thumbnail_depan` and every detail `galeri[].url`.
 *
 * REAL BUG FIX (found via live testing after the initial API migration shipped): these paths are
 * NOT servable from the `mobixbydss.id` origin at all — `https://mobixbydss.id/unit-file-serve?...`
 * 404s unconditionally, even for a freshly-fetched path. The real file-serving backend is a
 * DIFFERENT host entirely, confirmed via a live browser Network-tab capture of the actual `<img>`
 * request the site itself makes: `https://mobix.motovax.com/unit-file-serve?path=...&raw=1`
 * (`mobix.motovax.com` also appears in the site's own CSP `connect-src`/`img-src`, alongside
 * `api.mobixbydss.id` — this app fans requests out across several backend hosts, not just its own
 * origin). `raw=1` matters too: without it the same path 200s but returns a much smaller,
 * re-encoded thumbnail (confirmed: 25KB vs 130KB for the same file) rather than the original.
 * `origin` (the scraped listing's own host) is intentionally NOT used here — the photo CDN is a
 * fixed, separate real backend, unrelated to whatever host `listingUrl`/`apiBaseUrl` point at.
 */
const PHOTO_CDN_ORIGIN = "https://mobix.motovax.com";

export function absolutePhotoUrl(path: string): string {
  const url = new URL(path, PHOTO_CDN_ORIGIN);
  url.searchParams.set("raw", "1");
  return url.toString();
}

/** `"MANUAL"` → `"MT"`, `"AUTOMATIC"` → `"AT"`, case-insensitive. Anything else is a real parse error. */
export function normalizeTransmission(raw: string): Result<Transmission, ParseError> {
  switch (raw.trim().toUpperCase()) {
    case "MANUAL":
    case "MT":
      return ok("MT");
    case "AUTOMATIC":
    case "AT":
      return ok("AT");
    default:
      return err(new ParseError(`MobixUnitMapper: unrecognized transmisi "${raw}"`));
  }
}

export interface ToScrapedUnitOptions {
  /** Origin of the mobixbydss.id deployment, e.g. `"https://mobixbydss.id"`. */
  readonly origin: string;
  readonly clock: () => Date;
  readonly onWarning?: ScrapeWarningListener;
}

/**
 * Maps ONE real `/api/get-all-produk` item onto a `ScrapedUnit`.
 *
 * `available` is hard-coded `true` because NO field in either real payload expresses availability —
 * there is no `sold`/`terjual` boolean anywhere. The listing endpoint presumably already excludes
 * sold units, so "present in the listing" is the only availability signal that actually exists;
 * inventing a field would be fabrication. `DetectInventoryChanges` still detects sold units for
 * real, by diffing which `identityKey`s DISAPPEARED between sessions (`UnitSoldOut`).
 *
 * `photos` holds only the listing thumbnail here. The full ~11-photo gallery lives behind
 * `/api/get-detail-produk` and is fetched per-unit by `MobixUnitDetailFetcher` — see
 * `DownloadAndStorePhotos`, which resolves it before downloading.
 */
export function toScrapedUnit(
  raw: unknown,
  options: ToScrapedUnitOptions,
): Result<ScrapedUnit, ParseError> {
  const parsed = mobixListingItemSchema.safeParse(raw);
  if (!parsed.success) {
    const slug =
      typeof raw === "object" && raw !== null && "slug" in raw
        ? String(raw.slug)
        : "<unknown slug>";
    return err(
      new ParseError(
        `MobixUnitMapper: listing item "${slug}" did not match the expected API shape: ` +
          parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; "),
      ),
    );
  }
  const item: MobixListingItem = parsed.data;

  const transmission = normalizeTransmission(item.transmisi);
  if (!transmission.ok) {
    return err(new ParseError(`${transmission.error.message} (unit "${item.slug}")`));
  }

  const urlResult = UnitUrl.create(`${options.origin}${UNIT_PATH_PREFIX}${item.slug}`);
  if (!urlResult.ok) {
    return err(new ParseError(`MobixUnitMapper: ${urlResult.error.message}`));
  }

  const priceResult = ScrapedPrice.create(item.harga);
  if (!priceResult.ok) {
    return err(
      new ParseError(`MobixUnitMapper: unit "${item.slug}": ${priceResult.error.message}`),
    );
  }

  // Missing/absent odometer defaults to 0 rather than failing the item — real brand-new units have
  // no recorded mileage at all (no `odometer` key, `jarakTempuh: ""`).
  const kmResult = ScrapedKilometer.create(item.odometer ?? 0);
  if (!kmResult.ok) {
    return err(new ParseError(`MobixUnitMapper: unit "${item.slug}": ${kmResult.error.message}`));
  }

  // `Branch.UMUM` is named directly rather than read back from `branch`: `normalizeCabang` invokes
  // this callback synchronously, while `branch` is still in its temporal dead zone.
  const branch = normalizeCabang(item.cabang, (rawCabang) => {
    options.onWarning?.({
      type: "branch_fallback",
      rawCabang,
      slug: item.slug,
      fallback: Branch.UMUM,
    });
  });

  const thumbnail = item.thumbnail ?? item.thumbnail_depan;
  const photos = thumbnail !== undefined ? [absolutePhotoUrl(thumbnail)] : [];

  const unitResult = ScrapedUnit.create({
    url: urlResult.value,
    model: item.type,
    brand: item.merek,
    year: item.year,
    transmission: transmission.value,
    color: item.color,
    kilometer: kmResult.value,
    price: priceResult.value,
    branch,
    photos,
    available: true,
    scrapedAt: ScrapeTimestamp.now(options.clock),
  });
  if (!unitResult.ok) {
    return err(new ParseError(`MobixUnitMapper: unit "${item.slug}": ${unitResult.error.message}`));
  }
  return ok(unitResult.value);
}
