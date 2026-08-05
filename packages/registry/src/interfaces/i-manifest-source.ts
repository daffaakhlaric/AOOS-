import type { ManifestFormat } from "../contracts/tenant-scope.js";

/** A raw manifest read from disk (or, in the future, a Remote Registry), before validation. */
export interface RawManifest {
  readonly format: ManifestFormat;
  readonly sourcePath: string;
  readonly data: unknown;
}

/** Port for anything that can produce raw manifests — a local directory today, a Remote Registry (docs/PROMPT-005.3-REGISTRY-SYSTEM.md) later. */
export interface IManifestSource {
  load(location: string): Promise<readonly RawManifest[]>;
}
