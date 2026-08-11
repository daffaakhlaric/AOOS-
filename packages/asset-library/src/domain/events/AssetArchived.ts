/** Payload for `aaos.assets.archived` — emitted by `ArchiveAsset` and `ArchiveUnitAssets` (once per archived asset) after a status transition to `ARCHIVED`. */
export interface AssetArchived {
  readonly assetId: string;
  readonly unitId?: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: string;
}
