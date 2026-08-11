/** The kind of creative asset stored in `mobix-assets` (spec's Asset Domain Model). */
export enum AssetType {
  UNIT_PHOTO = "UNIT_PHOTO",
  BRAND = "BRAND",
  TESTIMONIAL = "TESTIMONIAL",
  AI_VIDEO = "AI_VIDEO",
  AI_IMAGE = "AI_IMAGE",
  OVERLAY = "OVERLAY",
}

/** Runtime validator, used at repository/mapper boundaries where a raw DB string must be narrowed. */
export function parseAssetType(raw: string): AssetType | undefined {
  return Object.values(AssetType).includes(raw as AssetType) ? (raw as AssetType) : undefined;
}
