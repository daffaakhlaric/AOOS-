import type { KnowledgeAsset } from "@aos/knowledge-engine";

import type { KnowledgeFilterSet } from "../domain/knowledge-filter-set.js";
import type { KnowledgeResult } from "../domain/knowledge-result.js";
import type { KnowledgeResolver } from "../resolver/knowledge-resolver.js";

/**
 * "FILTERING: Permission, Policy, Workspace, Department, Tenant, Classification,
 * Language, Region, Category, Tags, Version, Template, Source, Asset Type, Lifecycle."
 * (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — applies the 13 structural fields of
 * `KnowledgeFilterSet` (Permission/Policy are handled separately by
 * `KnowledgePermissionResolver`/`KnowledgePolicyResolver` — never duplicated here) by
 * resolving each Result's underlying `KnowledgeAsset` and comparing its real fields.
 */
export class KnowledgeFilter {
  constructor(private readonly resolver: KnowledgeResolver) {}

  apply(
    results: readonly KnowledgeResult[],
    filters: KnowledgeFilterSet,
  ): readonly KnowledgeResult[] {
    if (!this.hasAnyStructuralFilter(filters)) {
      return results;
    }
    return results.filter((result) => {
      const asset = this.resolver.tryResolveAsset(result.assetId);
      if (!asset) {
        return false;
      }
      return this.matches(asset, filters);
    });
  }

  private matches(asset: KnowledgeAsset, filters: KnowledgeFilterSet): boolean {
    if (filters.workspaceId !== undefined && asset.scope.workspaceId !== filters.workspaceId) {
      return false;
    }
    if (filters.departmentId !== undefined && asset.scope.departmentId !== filters.departmentId) {
      return false;
    }
    if (filters.tenantId !== undefined && asset.scope.tenantId !== filters.tenantId) {
      return false;
    }
    if (filters.classification !== undefined && asset.classification !== filters.classification) {
      return false;
    }
    if (filters.language !== undefined && asset.metadata.language !== filters.language) {
      return false;
    }
    if (filters.region !== undefined && asset.metadata.region !== filters.region) {
      return false;
    }
    if (filters.categoryId !== undefined && asset.categoryId !== filters.categoryId) {
      return false;
    }
    if (filters.tags !== undefined && !filters.tags.every((tag) => asset.tags.includes(tag))) {
      return false;
    }
    if (
      filters.version !== undefined &&
      `${asset.version.major}.${asset.version.minor}.${asset.version.patch}` !== filters.version
    ) {
      return false;
    }
    if (filters.templateId !== undefined && asset.templateId !== filters.templateId) {
      return false;
    }
    if (filters.source !== undefined && asset.sourceId !== filters.source) {
      return false;
    }
    if (filters.assetType !== undefined && asset.assetType !== filters.assetType) {
      return false;
    }
    if (filters.lifecycleState !== undefined && asset.lifecycleState !== filters.lifecycleState) {
      return false;
    }
    return true;
  }

  private hasAnyStructuralFilter(filters: KnowledgeFilterSet): boolean {
    return (
      filters.workspaceId !== undefined ||
      filters.departmentId !== undefined ||
      filters.tenantId !== undefined ||
      filters.classification !== undefined ||
      filters.language !== undefined ||
      filters.region !== undefined ||
      filters.categoryId !== undefined ||
      filters.tags !== undefined ||
      filters.version !== undefined ||
      filters.templateId !== undefined ||
      filters.source !== undefined ||
      filters.assetType !== undefined ||
      filters.lifecycleState !== undefined
    );
  }
}
