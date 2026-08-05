import type { BaseManifest } from "../contracts/base-manifest.js";

/** Optional hook a Registry kind can supply to transform a manifest across a breaking version change. */
export interface IMigrationHook<TManifest extends BaseManifest = BaseManifest> {
  readonly fromVersion: string;
  readonly toVersion: string;
  migrate(manifest: TManifest): TManifest;
}
