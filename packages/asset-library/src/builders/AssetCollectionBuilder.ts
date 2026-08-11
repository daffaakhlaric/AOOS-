import { err, ok, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import { AssetCollection } from "../domain/entities/AssetCollection.js";

import type { AssetBuilder } from "./AssetBuilder.js";

/** Fluent builder (Builder Pattern) for `AssetCollection` — collects one or more `AssetBuilder`s and builds them together, short-circuiting on the first failure. */
export class AssetCollectionBuilder {
  private builders: AssetBuilder[] = [];

  withAsset(builder: AssetBuilder): this {
    this.builders.push(builder);
    return this;
  }

  withAssets(builders: readonly AssetBuilder[]): this {
    this.builders.push(...builders);
    return this;
  }

  build(): Result<AssetCollection, ValidationError> {
    const assets = [];
    for (const builder of this.builders) {
      const result = builder.build();
      if (!result.ok) {
        return err(result.error);
      }
      assets.push(result.value);
    }
    return ok(AssetCollection.of(assets));
  }
}
