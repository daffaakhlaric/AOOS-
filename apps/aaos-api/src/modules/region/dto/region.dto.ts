/**
 * `GET /api/v1/region/provinces|regencies/:provinceId|districts/:regencyId` response shape —
 * real Indonesian administrative reference data, read-through-proxied from `ibnux.github.io/
 * data-indonesia` (see `infrastructure/wilayah-client.ts`'s class doc for why that specific
 * public source).
 *
 * Deliberately drops the upstream `latitude`/`longitude` fields: nothing in this codebase (the
 * Listing form, `LocationResolverService`, `SearchAdLocations`) consumes coordinates today, only
 * the `id`/`nama` pair — verified directly against those real call sites before narrowing this
 * DTO. Add them back honestly if a future map view genuinely needs them, never speculatively.
 */
export interface RegionOptionDto {
  readonly id: string;
  readonly nama: string;
}

export interface RegionListResponseDto {
  readonly items: readonly RegionOptionDto[];
}
