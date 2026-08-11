/** Payload for `aaos.assets.uploaded` — emitted by `UploadAsset` and `SaveAiCreative` after a file is persisted to Supabase Storage and its metadata row inserted. */
export interface AssetUploaded {
  readonly assetId: string;
  readonly assetType: string;
  readonly unitId?: string;
  readonly branch?: string;
  readonly storagePath: string;
  readonly publicUrl: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: string;
}
