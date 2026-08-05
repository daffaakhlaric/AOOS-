import type { KnowledgeAssetType } from "../domain/knowledge-asset-type.js";
import type { KnowledgeClassification } from "../domain/knowledge-classification.js";
import type { KnowledgeLifecycleState } from "../domain/knowledge-lifecycle-state.js";

export interface KnowledgeCatalogQuery {
  readonly assetType?: KnowledgeAssetType;
  readonly classification?: KnowledgeClassification;
  readonly lifecycleState?: KnowledgeLifecycleState;
  readonly tenantId?: string;
  readonly workspaceId?: string;
  readonly categoryId?: string;
  readonly tag?: string;
  readonly label?: string;
}
