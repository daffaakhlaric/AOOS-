import type { KnowledgeAsset } from "@aos/knowledge-engine";

import type { KnowledgeRuntimeExecution } from "../../src/domain/knowledge-runtime-execution.js";
import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";

const factory = new KnowledgeRuntimeFactory();

/** Builds a fresh `KnowledgeRuntimeExecution` in the `CREATED` state for a given saved `KnowledgeAsset`. */
export function executionFixture(asset: KnowledgeAsset): KnowledgeRuntimeExecution {
  return factory.createExecution({
    knowledgeId: asset.id,
    tenantId: asset.scope.tenantId,
    workspaceId: asset.scope.workspaceId,
    assetNamespace: asset.namespace,
  });
}
