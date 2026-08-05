import {
  createKnowledgeContext,
  KnowledgeEngine,
  KnowledgeEvents,
  type KnowledgeAsset,
} from "@aos/knowledge-engine";
import {
  createKnowledgeIndexContext,
  KnowledgeIndexEvents,
  KnowledgeIndexing,
} from "@aos/knowledge-indexing";
import { createExecutionToken } from "@aos/workflow-execution";

import { assetFixture } from "./asset-fixture.js";
import { fakePublisher } from "./publisher-fixture.js";

export interface EngineFixture {
  readonly engine: KnowledgeEngine;
  readonly indexing: KnowledgeIndexing;
  readonly asset: KnowledgeAsset;
}

/**
 * Builds a real `KnowledgeEngine` + `KnowledgeIndexing` pair with one saved and indexed
 * `KnowledgeAsset` — `@aos/knowledge-retrieval`'s `KnowledgeResolver` reads through both,
 * never writes.
 */
export async function engineFixture(
  overrides: { tenantId?: string; workspaceId?: string } = {},
): Promise<EngineFixture> {
  const { publisher } = fakePublisher();
  const engine = new KnowledgeEngine({ events: new KnowledgeEvents(publisher) });
  const indexing = new KnowledgeIndexing({ events: new KnowledgeIndexEvents(publisher) });
  const tenantId = overrides.tenantId ?? "tenant-1";
  const workspaceId = overrides.workspaceId ?? "workspace-1";

  const document = assetFixture({ scope: { tenantId, workspaceId } });

  const context = createKnowledgeContext({
    token: createExecutionToken({ workflowInstanceId: "wf-instance-1" }),
    tenantId,
    workspaceId,
  });

  const asset = await engine.createAsset(document, context);

  await indexing.indexAsset({
    asset,
    context: createKnowledgeIndexContext({ assetId: asset.id, tenantId, workspaceId }),
  });

  return { engine, indexing, asset };
}
