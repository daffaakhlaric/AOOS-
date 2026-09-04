/** Mirrors `apps/aaos-api`'s `modules/region` DTOs — the real public wilayah (province/kabupaten/
 * kecamatan) catalog backing the Listing form's cascading picker. */
export interface RegionOptionDto {
  readonly id: string;
  readonly nama: string;
}

export interface RegionListDto {
  readonly items: readonly RegionOptionDto[];
}
