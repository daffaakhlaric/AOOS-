import type { BaseManifest } from "../contracts/base-manifest.js";
import type { IMigrationHook } from "../interfaces/i-migration-hook.js";

/**
 * Holds Migration Hooks (docs/PROMPT-005.3-REGISTRY-SYSTEM.md — "Migration Hook Interface")
 * keyed by `${fromVersion}->${toVersion}` and applies the matching one, if any, when a manifest
 * crosses a breaking version boundary. No hook is required to exist — migration is opt-in per
 * Registry kind; if none is registered for a given from/to pair, the manifest passes through unchanged.
 */
export class MigrationHookRegistry<TManifest extends BaseManifest = BaseManifest> {
  private readonly hooks = new Map<string, IMigrationHook<TManifest>>();

  register(hook: IMigrationHook<TManifest>): void {
    this.hooks.set(this.key(hook.fromVersion, hook.toVersion), hook);
  }

  apply(manifest: TManifest, fromVersion: string, toVersion: string): TManifest {
    const hook = this.hooks.get(this.key(fromVersion, toVersion));
    return hook ? hook.migrate(manifest) : manifest;
  }

  has(fromVersion: string, toVersion: string): boolean {
    return this.hooks.has(this.key(fromVersion, toVersion));
  }

  private key(fromVersion: string, toVersion: string): string {
    return `${fromVersion}->${toVersion}`;
  }
}
