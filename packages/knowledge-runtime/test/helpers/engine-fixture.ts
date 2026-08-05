import {
  buildKnowledgeNamespaceUri,
  createKnowledgeContext,
  KnowledgeAssetType,
  KnowledgeClassification,
  KnowledgeEngine,
  KnowledgeEvents,
  type KnowledgeAsset,
} from "@aos/knowledge-engine";
import { createExecutionToken } from "@aos/workflow-execution";

import { fakePublisher } from "./publisher-fixture.js";

export interface EngineFixture {
  readonly engine: KnowledgeEngine;
  readonly asset: KnowledgeAsset;
}

/** Builds a real `KnowledgeEngine` with one saved `KnowledgeAsset` — `@aos/knowledge-runtime` only ever reads through this Engine, never writes. */
export async function engineFixture(
  overrides: { tenantId?: string; workspaceId?: string } = {},
): Promise<EngineFixture> {
  const { publisher } = fakePublisher();
  const engine = new KnowledgeEngine({ events: new KnowledgeEvents(publisher) });
  const tenantId = overrides.tenantId ?? "tenant-1";
  const workspaceId = overrides.workspaceId ?? "workspace-1";

  const document = engine.factory.document.create({
    namespace: buildKnowledgeNamespaceUri(tenantId, workspaceId, "library-1", "doc-1"),
    assetType: KnowledgeAssetType.SUPPORT,
    scope: { tenantId, workspaceId },
    classification: KnowledgeClassification.INTERNAL,
    ownerId: "user-1",
  });

  const context = createKnowledgeContext({
    token: createExecutionToken({ workflowInstanceId: "wf-instance-1" }),
    tenantId,
    workspaceId,
  });

  const asset = await engine.createAsset(document, context);
  return { engine, asset };
}
