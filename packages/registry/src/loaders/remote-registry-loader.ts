import type { IManifestSource, RawManifest } from "../interfaces/i-manifest-source.js";

/**
 * Reserved for a future Remote Registry source (docs/PROMPT-005.3-REGISTRY-SYSTEM.md —
 * "Future: Remote Registry"). Implements the IManifestSource port so a future HTTP/gRPC-backed
 * implementation can be dropped in without changing any Loader/Registry call site — but this
 * class itself is intentionally unimplemented (throws) at this phase, not a working network client.
 */
export class RemoteRegistryLoader implements IManifestSource {
  async load(location: string): Promise<readonly RawManifest[]> {
    throw new Error(
      `Remote Registry loading is not implemented yet (requested location: "${location}"). ` +
        "This is a reserved extension point — see docs/PROMPT-005.3-REGISTRY-SYSTEM.md.",
    );
  }
}
