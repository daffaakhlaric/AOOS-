import type { Branch } from "@aos/meta-ads-connector";

import type { AssetTag } from "../domain/value-objects/AssetTag.js";
import type { AssetType } from "../domain/value-objects/AssetType.js";

export interface DeriveTagsInput {
  readonly type: AssetType;
  readonly unitModel?: string;
  readonly unitYear?: number;
  readonly branch?: Branch;
}

/** Derives structured tags ("branch, model, year, angle" per spec) from unit metadata, so `UploadAsset`/`SaveAiCreative` don't hand-roll tag strings inline. */
export interface IAssetTagger {
  deriveTags(input: DeriveTagsInput): ReadonlyArray<AssetTag>;
}
