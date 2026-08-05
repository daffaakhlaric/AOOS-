import type {
  KnowledgeAsset,
  KnowledgeCatalog,
  KnowledgeCatalogQuery,
  KnowledgeRegistry,
  KnowledgeRegistryBucket,
  KnowledgeRepository,
} from "@aos/knowledge-engine";

import { KnowledgeAssetNotLoadedException } from "../errors/knowledge-asset-not-loaded-exception.js";

import type { IKnowledgeRuntimeLoader } from "./i-knowledge-runtime-loader.js";

/**
 * "RUNTIME LOADER: Loads Knowledge Assets from Knowledge Registry, Knowledge Repository,
 * Knowledge Catalog. Read-only only." (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) — never
 * mutates a `KnowledgeAsset`, never touches `@aos/knowledge-engine`'s write path
 * (`KnowledgeEngine.createAsset()`/`updateAsset()`/etc). This package only reads what
 * 005.7A already validated and stored.
 */
export class KnowledgeRuntimeLoader implements IKnowledgeRuntimeLoader {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly catalog: KnowledgeCatalog,
    private readonly registry: KnowledgeRegistry,
  ) {}

  loadById(id: string): KnowledgeAsset {
    const asset = this.repository.get(id);
    if (!asset) {
      throw new KnowledgeAssetNotLoadedException(
        `KnowledgeRuntimeLoader could not read KnowledgeAsset "${id}" from the Knowledge Repository`,
      );
    }
    return asset;
  }

  loadByNamespace(uri: string): KnowledgeAsset {
    const asset = this.repository.getByNamespace(uri);
    if (!asset) {
      throw new KnowledgeAssetNotLoadedException(
        `KnowledgeRuntimeLoader could not read a KnowledgeAsset under namespace "${uri}" from the Knowledge Repository`,
      );
    }
    return asset;
  }

  tryLoadById(id: string): KnowledgeAsset | undefined {
    return this.repository.get(id);
  }

  tryLoadByNamespace(uri: string): KnowledgeAsset | undefined {
    return this.repository.getByNamespace(uri);
  }

  search(query: KnowledgeCatalogQuery = {}): readonly KnowledgeAsset[] {
    return this.catalog.search(query);
  }

  /** Read-only pass-through to the Knowledge Registry — never registers/replaces/removes anything. */
  requireFromRegistry<T extends { id: string }>(bucket: KnowledgeRegistryBucket, id: string): T {
    try {
      return this.registry.require<T>(bucket, id);
    } catch (cause) {
      throw new KnowledgeAssetNotLoadedException(
        `KnowledgeRuntimeLoader could not read "${id}" from Knowledge Registry bucket "${bucket}"`,
        { cause },
      );
    }
  }
}
