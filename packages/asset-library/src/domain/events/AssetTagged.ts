/** Payload for `aaos.assets.tagged` — emitted by `TagAsset` after tags are added to an asset. */
export interface AssetTagged {
  readonly assetId: string;
  readonly tags: readonly string[];
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: string;
}
