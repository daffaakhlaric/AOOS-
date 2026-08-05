import type { KnowledgeAsset } from "../domain/knowledge-asset.js";
import { AssetNotFoundException } from "../errors/asset-not-found-exception.js";
import { DuplicateAssetException } from "../errors/duplicate-asset-exception.js";

/**
 * The in-memory store of `KnowledgeAsset` aggregates — every other module
 * (`KnowledgeCatalog`, `KnowledgeResolver`, `KnowledgeEngine`) reads/writes Assets
 * exclusively through this class. No persistence backend — see README "Persistence".
 */
export class KnowledgeRepository {
  private readonly assetsById = new Map<string, KnowledgeAsset>();
  private readonly idByNamespace = new Map<string, string>();

  save(asset: KnowledgeAsset): KnowledgeAsset {
    if (this.assetsById.has(asset.id)) {
      throw new DuplicateAssetException(
        `KnowledgeAsset "${asset.id}" is already saved — use update() instead`,
      );
    }
    this.assetsById.set(asset.id, asset);
    this.idByNamespace.set(asset.namespace, asset.id);
    return asset;
  }

  update(asset: KnowledgeAsset): KnowledgeAsset {
    this.require(asset.id);
    this.assetsById.set(asset.id, asset);
    this.idByNamespace.set(asset.namespace, asset.id);
    return asset;
  }

  get(id: string): KnowledgeAsset | undefined {
    return this.assetsById.get(id);
  }

  require(id: string): KnowledgeAsset {
    const asset = this.assetsById.get(id);
    if (!asset) {
      throw new AssetNotFoundException(`No KnowledgeAsset is saved with id "${id}"`);
    }
    return asset;
  }

  getByNamespace(namespace: string): KnowledgeAsset | undefined {
    const id = this.idByNamespace.get(namespace);
    return id ? this.assetsById.get(id) : undefined;
  }

  remove(id: string): boolean {
    const asset = this.assetsById.get(id);
    if (!asset) {
      return false;
    }
    this.assetsById.delete(id);
    this.idByNamespace.delete(asset.namespace);
    return true;
  }

  list(): readonly KnowledgeAsset[] {
    return Array.from(this.assetsById.values());
  }

  count(): number {
    return this.assetsById.size;
  }
}
