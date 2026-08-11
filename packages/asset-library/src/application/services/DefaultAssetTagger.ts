import { unwrap } from "@aos/common";

import type { DeriveTagsInput, IAssetTagger } from "../../contracts/IAssetTagger.js";
import { AssetTag } from "../../domain/value-objects/AssetTag.js";

/**
 * Default `IAssetTagger` — derives `key:value` tag strings from unit metadata (branch, model,
 * year) and the asset's own type, per the spec's "Tag assets by unit, model, branch, type"
 * responsibility. Every derived string is non-empty by construction, so `AssetTag.create` never
 * fails here — `unwrap` is safe.
 */
export class DefaultAssetTagger implements IAssetTagger {
  deriveTags(input: DeriveTagsInput): ReadonlyArray<AssetTag> {
    const tags: AssetTag[] = [unwrap(AssetTag.create(`type:${input.type}`))];
    if (input.branch !== undefined) {
      tags.push(unwrap(AssetTag.create(`branch:${input.branch}`)));
    }
    if (input.unitModel !== undefined && input.unitModel.trim().length > 0) {
      tags.push(unwrap(AssetTag.create(`model:${input.unitModel}`)));
    }
    if (input.unitYear !== undefined) {
      tags.push(unwrap(AssetTag.create(`year:${String(input.unitYear)}`)));
    }
    return tags;
  }
}
