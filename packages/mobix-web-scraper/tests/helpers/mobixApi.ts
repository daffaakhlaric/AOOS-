import { HttpResponse, http } from "msw";

/**
 * REAL mobixbydss.id API payloads, captured live via curl on 2026-08-17 and pasted verbatim (only
 * the per-page item count and the detail `galeri` length are trimmed — the real page carries ~12
 * items and the real gallery 11 entries). Nothing here is invented: every field name, casing quirk
 * (`"Mitsubishi"` vs `"MITSUBISHI"`), Indonesian string, and relative `/unit-file-serve?path=…`
 * photo path is exactly what the live API returned.
 *
 * These back every test in this package — no test ever touches the network (`msw` intercepts
 * everything), per the README's "MSW fixture setup for testing" rule.
 */

export const API_ORIGIN = "https://mobixbydss.id";
export const LISTING_PAGE_URL = `${API_ORIGIN}/produk`;
export const LISTING_API_URL = `${API_ORIGIN}/api/get-all-produk`;
export const DETAIL_API_URL = `${API_ORIGIN}/api/get-detail-produk`;

/** Real listing item — Mitsubishi Xpander GLS MT 2022, branch BINTARO, has `odometer`. */
export const REAL_ITEM_XPANDER_GLS = {
  aging: 21,
  bahanBakar: "bensin",
  bpkb_name: "0",
  cabang: "BINTARO",
  category: "MPV",
  cicilan: 4223200,
  color: "Hitam",
  dp: 27000000,
  harga: 180000000,
  harga_kredit: 180000000,
  id: "fd58b513-16f2-4d1b-9d1f-3940371dcc49",
  jarakTempuh: "60845 KM",
  merek: "Mitsubishi",
  nama: "Mitsubishi Xpander GLS MT 2022 Hitam",
  notes_unit: "8%",
  odometer: 60845,
  pembiayaan: {
    eligible: true,
    max_vehicle_age_years: 14,
    message: null,
    provider: "dsf",
    reason_code: null,
    status: "available",
    vehicle_age_years: 4,
  },
  plate_no: "B1080DFZ",
  posisi: "BINTARO",
  slug: "mitsubishi-xpander-gls-mt-2022-fd58b513",
  stnk_expiry: "2026-09-12",
  tdp: 33442000,
  thumbnail_depan:
    "/unit-file-serve?path=%2Fdata%2Fvehicle-media%2F4c8bdcb3-c535-4ad6-b2fb-53f5361c8489%2FB1080DFZ%2F2026-07%2Fef86668273b647d085962481f57070856cc071dc195032498578c040607dd15f.jpg",
  transmisi: "MANUAL",
  type: "Xpander GLS MT",
  video: [],
  year: 2022,
  thumbnail:
    "/unit-file-serve?path=%2Fdata%2Fvehicle-media%2F4c8bdcb3-c535-4ad6-b2fb-53f5361c8489%2FB1080DFZ%2F2026-07%2Fef86668273b647d085962481f57070856cc071dc195032498578c040607dd15f.jpg",
} as const;

/**
 * Real listing item — MITSUBISHI Xpander Cross 2023, `cabang: "PONDOK BAMBU"`. That branch is a real
 * physical dealer with NO `Branch` enum member, so this fixture is what drives the
 * `normalizeCabang` → `Branch.UMUM` fallback + warning path. Also note `thumbnail` is ABSENT here
 * (only `thumbnail_depan` is present), exactly as the live payload had it.
 */
export const REAL_ITEM_XPANDER_CROSS = {
  aging: 30,
  bahanBakar: "bensin",
  bpkb_name: "PT EPLUSE BEAUTIFUL GATE",
  cabang: "PONDOK BAMBU",
  category: "MPV",
  cicilan: 6424900,
  color: "Abu Abu Tua",
  dp: 41250000,
  harga: 275000000,
  harga_kredit: 275000000,
  id: "fdd6a5c3-2fe1-470f-bcd4-87918b49b087",
  jarakTempuh: "39002 KM",
  merek: "MITSUBISHI",
  nama: "MITSUBISHI Xpander Cross 1.5L Plus (4X2) 2023 Abu Abu Tua",
  notes_unit: "Tidak ada data",
  odometer: 39002,
  pembiayaan: {
    eligible: true,
    max_vehicle_age_years: 14,
    message: null,
    provider: "dsf",
    reason_code: null,
    status: "available",
    vehicle_age_years: 3,
  },
  plate_no: "B1134JFS",
  posisi: "PONDOK BAMBU",
  slug: "mitsubishi-xpander-cross-1-5l-plus-4x2-2023-fdd6a5c3",
  stnk_expiry: "2027-07-31",
  tdp: 47945000,
  thumbnail_depan:
    "/unit-file-serve?path=%2Fdata%2Fvehicle-media%2F4c8bdcb3-c535-4ad6-b2fb-53f5361c8489%2FB1134JFS%2F2026-07%2F2c9ac0a50424c87b455f28d946602949d1e7fc5d1b9580402096c5c8a4a2aaa1.jpg",
  transmisi: "AUTOMATIC",
  type: "Xpander Cross 1.5L Plus (4X2)",
  video: [],
  year: 2023,
} as const;

/**
 * Real edge case observed live: a brand-new unit with NO `odometer` key at all and an empty
 * `jarakTempuh`. Built off the real GLS item so only the genuinely-differing fields vary.
 */
export function realItemWithoutOdometer(): Record<string, unknown> {
  const { odometer: _omitted, ...rest } = REAL_ITEM_XPANDER_GLS;
  return {
    ...rest,
    jarakTempuh: "",
    year: 2026,
    slug: "mitsubishi-xpander-gls-mt-2026-brandnew",
  };
}

export interface ListingPageOptions {
  readonly page: number;
  readonly totalPages: number;
  readonly items: ReadonlyArray<Record<string, unknown>>;
  readonly totalData?: number;
}

/** Builds a listing response with the real envelope shape (`status`/`code`/`error`/`message`/`data`/`meta`). */
export function listingResponse(options: ListingPageOptions): Record<string, unknown> {
  return {
    status: "success",
    code: 200,
    error: "",
    message: "Data berhasil ditemukan",
    data: options.items,
    meta: {
      lastRequest: "2026-08-17T13:03:09Z",
      limit: 12,
      page: options.page,
      total_data: options.totalData ?? options.items.length,
      total_pages: options.totalPages,
    },
  };
}

/** The real detail response for the Xpander GLS, `galeri` trimmed to 3 of its real 11 entries. */
export const REAL_DETAIL_RESPONSE = {
  status: "success",
  code: 200,
  error: "",
  message: "Data berhasil ditemukan",
  data: {
    aging: 21,
    bpkb_name: "0",
    branch: "BINTARO",
    brand: "Mitsubishi",
    category: "mpv",
    cicilan: 4223200,
    color: "Hitam",
    deskripsi:
      "Interior luas. Ground clearance tinggi. 7 kursi. Fitur keselamatan lengkap. AC belakang. Power window. Bluetooth. Layar sentuh 7 inch. ABS. Vehicle Stability Control.",
    dp: 27000000,
    galeri: [
      {
        id: "1",
        url: "/unit-file-serve?path=%2Fdata%2Fvehicle-media%2F4c8bdcb3-c535-4ad6-b2fb-53f5361c8489%2FB1080DFZ%2F2026-07%2F1c3f17d15d1fb09d6865fad117b9a555780354400b4bb96d8243a78ce5a65716.jpg",
      },
      {
        id: "2",
        url: "/unit-file-serve?path=%2Fdata%2Fvehicle-media%2F4c8bdcb3-c535-4ad6-b2fb-53f5361c8489%2FB1080DFZ%2F2026-07%2Fef86668273b647d085962481f57070856cc071dc195032498578c040607dd15f.jpg",
      },
      {
        id: "3",
        url: "/unit-file-serve?path=%2Fdata%2Fvehicle-media%2F4c8bdcb3-c535-4ad6-b2fb-53f5361c8489%2FB1080DFZ%2F2026-07%2Fb8ef5d25724620617ea0bbc7120cf9222bc3705cdc349e442bd75ec616595dc1.jpg",
      },
    ],
    harga: 180000000,
    harga_kredit: 180000000,
    id: "fd58b513-16f2-4d1b-9d1f-3940371dcc49",
    kelengkapan_dokumen: { bpkb: "Ada: 0", nopol: "Ada: B1080DFZ", stnk: "Ada: 2026-09-12" },
    lokasi: "BINTARO",
    nama: "Mitsubishi Xpander GLS MT 2022 Hitam",
    nopol: "B1080DFZ",
    notes_unit: "8%",
    odometer: 60845,
    plate_no: "B1080DFZ",
    position: "BINTARO",
    slug: "mitsubishi-xpander-gls-mt-2022-fd58b513",
    stnk_expiry: "2026-09-12",
    tdp: 33442000,
    transmisi: "MANUAL",
    type: "Xpander GLS MT",
    video: [],
    year: 2022,
    harga_sejenis: [],
  },
  meta: { lastRequest: "2026-08-17T13:08:24Z", limit: 1, total_data: 1, page: 1, total_pages: 1 },
} as const;

/**
 * The real photo CDN — a DIFFERENT host from `API_ORIGIN`, confirmed via a live browser
 * Network-tab capture (`mobixbydss.id/unit-file-serve` 404s unconditionally; the real backend is
 * `mobix.motovax.com`). See `absolutePhotoUrl`'s docstring in `MobixUnitMapper.ts`.
 */
export const PHOTO_CDN_ORIGIN = "https://mobix.motovax.com";

/** Absolute URLs the detail fixture's `galeri` must resolve to (real CDN host + `raw=1`). */
export const REAL_DETAIL_PHOTO_URLS = REAL_DETAIL_RESPONSE.data.galeri.map((entry) => {
  const url = new URL(entry.url, PHOTO_CDN_ORIGIN);
  url.searchParams.set("raw", "1");
  return url.toString();
});

/**
 * MSW handler serving the listing endpoint page-by-page from `pages`, recording every requested page
 * number so a test can assert the exact pagination walk (that it stops precisely at
 * `meta.total_pages`).
 */
export function listingHandler(pages: ReadonlyArray<ReadonlyArray<Record<string, unknown>>>): {
  handler: ReturnType<typeof http.post>;
  requestedPages: number[];
} {
  const requestedPages: number[] = [];
  const handler = http.post(LISTING_API_URL, async ({ request }) => {
    const body = (await request.json()) as { page?: number };
    const page = body.page ?? 1;
    requestedPages.push(page);
    const items = pages[page - 1] ?? [];
    return HttpResponse.json(
      listingResponse({
        page,
        totalPages: pages.length,
        items,
        totalData: pages.reduce((sum, p) => sum + p.length, 0),
      }),
    );
  });
  return { handler, requestedPages };
}

/** MSW handler for the detail endpoint, recording every slug it was asked for. */
export function detailHandler(response: unknown = REAL_DETAIL_RESPONSE): {
  handler: ReturnType<typeof http.post>;
  requestedSlugs: string[];
} {
  const requestedSlugs: string[] = [];
  const handler = http.post(DETAIL_API_URL, async ({ request }) => {
    const body = (await request.json()) as { slug?: string };
    requestedSlugs.push(body.slug ?? "");
    return HttpResponse.json(response);
  });
  return { handler, requestedSlugs };
}

/** MSW handler serving a tiny real JPEG for any `/unit-file-serve` photo download, on the real CDN host. */
export function photoHandler(): ReturnType<typeof http.get> {
  return http.get(`${PHOTO_CDN_ORIGIN}/unit-file-serve`, () =>
    HttpResponse.arrayBuffer(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer, {
      headers: { "Content-Type": "image/jpeg" },
    }),
  );
}
