import type { KnowledgeAsset } from "../domain/knowledge-asset.js";
import { AssetNotFoundException } from "../errors/asset-not-found-exception.js";
import { parseKnowledgeNamespace } from "../namespace/knowledge-namespace.js";
import type { KnowledgeRepository } from "../repository/knowledge-repository.js";

/** "KnowledgeResolver ... Only resolution." — resolves one `KnowledgeAsset` by id or `knowledge://` namespace URI. Never mutates, never validates business rules — that is `KnowledgeValidator`'s job. */
export class KnowledgeResolver {
  constructor(private readonly repository: KnowledgeRepository) {}

  resolveById(id: string): KnowledgeAsset {
    return this.repository.require(id);
  }

  resolveByNamespace(uri: string): KnowledgeAsset {
    const parsed = parseKnowledgeNamespace(uri);
    const asset = this.repository.getByNamespace(parsed.uri);
    if (!asset) {
      throw new AssetNotFoundException(`No KnowledgeAsset is saved under namespace "${uri}"`);
    }
    return asset;
  }

  tryResolveById(id: string): KnowledgeAsset | undefined {
    return this.repository.get(id);
  }

  tryResolveByNamespace(uri: string): KnowledgeAsset | undefined {
    return this.repository.getByNamespace(uri);
  }
}
