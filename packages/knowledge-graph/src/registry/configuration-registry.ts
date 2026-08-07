import type { ResolvedGraphConfiguration } from "../domain/graph-configuration.js";
import { GraphConfigurationException } from "../errors/graph-configuration-exception.js";

import { RegistryBucket } from "./registry-bucket.js";

/** Registry key for the system-wide default configuration (applied when a graph has none of its own). */
export const DEFAULT_CONFIGURATION_KEY = "__default__";

/**
 * Id-keyed store of `ResolvedGraphConfiguration`, keyed by graph id (or `DEFAULT_CONFIGURATION_KEY`
 * for the system-wide default applied to graphs that don't override it).
 */
export class ConfigurationRegistry {
  private readonly bucket = new RegistryBucket<ResolvedGraphConfiguration>(
    "configuration",
    (id) => new GraphConfigurationException(`No configuration registered for key: ${id}`, { id }),
  );

  put(key: string, configuration: ResolvedGraphConfiguration): ResolvedGraphConfiguration {
    return this.bucket.put(key, configuration);
  }

  get(key: string): ResolvedGraphConfiguration {
    return this.bucket.get(key);
  }

  tryGet(key: string): ResolvedGraphConfiguration | undefined {
    return this.bucket.tryGet(key);
  }

  /** Resolves the configuration for `graphId`, falling back to the system-wide default. */
  resolveFor(graphId: string): ResolvedGraphConfiguration {
    return this.bucket.tryGet(graphId) ?? this.bucket.get(DEFAULT_CONFIGURATION_KEY);
  }

  has(key: string): boolean {
    return this.bucket.has(key);
  }

  remove(key: string): boolean {
    return this.bucket.remove(key);
  }

  list(): ResolvedGraphConfiguration[] {
    return this.bucket.list();
  }

  get size(): number {
    return this.bucket.size;
  }

  clear(): void {
    this.bucket.clear();
  }
}
