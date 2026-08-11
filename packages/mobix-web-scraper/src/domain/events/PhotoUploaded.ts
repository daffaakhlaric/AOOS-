/** Payload for `aaos.mobix-scraper.photo.uploaded`, emitted by `DownloadAndStorePhotos` for each unit photo successfully downloaded from mobixbydss.id and uploaded to `@aos/asset-library`. */
export interface PhotoUploaded {
  readonly identityKey: string;
  readonly photoUrl: string;
  readonly assetId: string;
  readonly publicUrl: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
