/** Lifecycle state of an `Asset` (spec's Asset Domain Model). */
export enum AssetStatus {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
  PENDING = "PENDING",
}

/** Runtime validator, used at repository/mapper boundaries where a raw DB string must be narrowed. */
export function parseAssetStatus(raw: string): AssetStatus | undefined {
  return Object.values(AssetStatus).includes(raw as AssetStatus) ? (raw as AssetStatus) : undefined;
}
