import { z } from "zod";

/**
 * Zod schemas for mobixbydss.id's REAL public JSON API, captured live on 2026-08-17.
 *
 * Only fields this package actually consumes are declared — the real payloads carry many more
 * (`aging`, `cicilan`, `dp`, `tdp`, `pembiayaan`, `bpkb_name`, `stnk_expiry`, `notes_unit`, …) which
 * are intentionally not modelled rather than guessed at. Every schema is non-strict, so those extra
 * fields pass through harmlessly and a new API field can never break a scrape.
 *
 * Endpoints:
 * - `POST /api/get-all-produk`   body `{"page": N}` (1-indexed) → paginated unit listing
 * - `POST /api/get-detail-produk` body `{"slug": "…"}`          → one unit's full detail + gallery
 */

/** `meta` block on the listing response. `total_pages` is the authoritative pagination bound. */
export const mobixPaginationMetaSchema = z.object({
  page: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  total_data: z.number().int().nonnegative(),
  /**
   * Trusted verbatim as the page-loop bound — it does NOT equal `ceil(total_data / limit)` on the
   * real API (observed live: `total_data: 244`, `limit: 12`, `total_pages: 14`, not 21), so any
   * computed division would scrape the wrong number of pages.
   */
  total_pages: z.number().int().nonnegative(),
});

export const mobixListingItemSchema = z.object({
  slug: z.string().min(1),
  /** Cleaner than `nama`, which bundles brand + year + color into one string. */
  type: z.string().min(1),
  merek: z.string().min(1),
  year: z.number().int(),
  transmisi: z.string(),
  color: z.string(),
  harga: z.number(),
  cabang: z.string(),
  /**
   * Absent on real brand-new/unregistered-mileage units (observed live alongside an empty
   * `jarakTempuh: ""` on a 2026 unit) — hence optional, defaulted to 0 by the mapper rather than
   * failing the item.
   */
  odometer: z.number().optional(),
  /** Relative `/unit-file-serve?path=…` path, NOT an absolute URL — see `absolutePhotoUrl`. */
  thumbnail: z.string().optional(),
  thumbnail_depan: z.string().optional(),
});

export type MobixListingItem = z.infer<typeof mobixListingItemSchema>;

export const mobixListingResponseSchema = z.object({
  status: z.string(),
  /** Items are validated one-by-one by the mapper so a parse error can name the offending slug. */
  data: z.array(z.unknown()),
  meta: mobixPaginationMetaSchema,
});

export const mobixGalleryEntrySchema = z.object({
  /** Relative `/unit-file-serve?path=…` path, same as the listing thumbnails. */
  url: z.string().min(1),
});

export const mobixDetailResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    slug: z.string().min(1),
    deskripsi: z.string().optional(),
    /** The real full photo set (11 entries on the captured unit); absent rather than `[]` is tolerated. */
    galeri: z.array(mobixGalleryEntrySchema).optional(),
  }),
});
