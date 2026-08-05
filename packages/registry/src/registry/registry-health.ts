import type { BaseManifest } from "../contracts/base-manifest.js";

import type { Registry } from "./registry.js";

export interface RegistryHealthReport {
  readonly status: "healthy" | "unhealthy";
  readonly entryCount: number;
  readonly cacheHitRatio: number;
}

/** Registry Health (docs/PROMPT-005.3-REGISTRY-SYSTEM.md): can this Registry be queried, and how effective is its cache. */
export class RegistryHealth<TManifest extends BaseManifest = BaseManifest> {
  constructor(private readonly registry: Registry<TManifest>) {}

  check(): RegistryHealthReport {
    try {
      const entries = this.registry.list();
      const metrics = this.registry.metrics.snapshot();
      const totalCacheLookups = metrics.cacheHits + metrics.cacheMisses;
      const cacheHitRatio = totalCacheLookups === 0 ? 1 : metrics.cacheHits / totalCacheLookups;
      return { status: "healthy", entryCount: entries.length, cacheHitRatio };
    } catch {
      return { status: "unhealthy", entryCount: 0, cacheHitRatio: 0 };
    }
  }
}
