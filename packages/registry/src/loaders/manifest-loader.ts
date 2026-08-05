import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

import yaml from "js-yaml";

import type { BaseManifest } from "../contracts/base-manifest.js";
import type { ILoader, LoadResult } from "../interfaces/i-loader.js";

const SUPPORTED_EXTENSIONS = new Set([".yaml", ".yml", ".json", ".ts", ".js", ".mjs"]);

/**
 * Loads manifests from a directory, supporting YAML, JSON, and TypeScript/JavaScript metadata
 * (a module exporting a `manifest` named export or a default export) — a Remote Registry
 * source (docs/PROMPT-005.3-REGISTRY-SYSTEM.md) is reserved for the future and not implemented
 * here; see interfaces/i-manifest-source.ts's `IManifestSource` port for that extension point.
 */
export class ManifestLoader<TManifest extends BaseManifest> implements ILoader<TManifest> {
  async load(location: string): Promise<LoadResult<TManifest>> {
    const loaded: TManifest[] = [];
    const failed: Array<{ sourcePath: string; error: string }> = [];

    let filenames: string[];
    try {
      filenames = await readdir(location);
    } catch (error) {
      return {
        loaded: [],
        failed: [
          { sourcePath: location, error: error instanceof Error ? error.message : String(error) },
        ],
      };
    }

    for (const filename of filenames) {
      const ext = extname(filename);
      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        continue;
      }
      const sourcePath = join(location, filename);
      try {
        loaded.push(await this.parseFile(sourcePath, ext));
      } catch (error) {
        failed.push({ sourcePath, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return { loaded, failed };
  }

  private async parseFile(sourcePath: string, ext: string): Promise<TManifest> {
    if (ext === ".yaml" || ext === ".yml") {
      const content = await readFile(sourcePath, "utf8");
      return yaml.load(content) as TManifest;
    }
    if (ext === ".json") {
      const content = await readFile(sourcePath, "utf8");
      return JSON.parse(content) as TManifest;
    }
    // .ts / .js / .mjs — TypeScript Metadata format: a module exporting `manifest` or a default export.
    const module = (await import(pathToFileURL(sourcePath).href)) as {
      manifest?: TManifest;
      default?: TManifest;
    };
    const manifest = module.manifest ?? module.default;
    if (!manifest) {
      throw new Error(`${sourcePath} does not export a "manifest" or default export`);
    }
    return manifest;
  }
}
