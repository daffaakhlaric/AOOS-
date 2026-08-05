import type { KnowledgeAsset } from "../domain/knowledge-asset.js";
import type { KnowledgeRepository } from "../repository/knowledge-repository.js";

import type { KnowledgeCatalogQuery } from "./knowledge-catalog-query.js";

/** A read-only, queryable index over `KnowledgeRepository` — never mutates an Asset, only filters. */
export class KnowledgeCatalog {
  constructor(private readonly repository: KnowledgeRepository) {}

  search(query: KnowledgeCatalogQuery = {}): readonly KnowledgeAsset[] {
    return this.repository.list().filter((asset) => this.matches(asset, query));
  }

  count(query: KnowledgeCatalogQuery = {}): number {
    return this.search(query).length;
  }

  private matches(asset: KnowledgeAsset, query: KnowledgeCatalogQuery): boolean {
    if (query.assetType !== undefined && asset.assetType !== query.assetType) {
      return false;
    }
    if (query.classification !== undefined && asset.classification !== query.classification) {
      return false;
    }
    if (query.lifecycleState !== undefined && asset.lifecycleState !== query.lifecycleState) {
      return false;
    }
    if (query.tenantId !== undefined && asset.scope.tenantId !== query.tenantId) {
      return false;
    }
    if (query.workspaceId !== undefined && asset.scope.workspaceId !== query.workspaceId) {
      return false;
    }
    if (query.categoryId !== undefined && asset.categoryId !== query.categoryId) {
      return false;
    }
    if (query.tag !== undefined && !asset.tags.includes(query.tag)) {
      return false;
    }
    if (query.label !== undefined && !asset.labels.includes(query.label)) {
      return false;
    }
    return true;
  }
}
