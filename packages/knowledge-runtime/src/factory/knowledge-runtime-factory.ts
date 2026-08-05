import type { CreateKnowledgeRuntimeContextInput } from "../context/create-knowledge-runtime-context.js";
import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";
import type { KnowledgeRuntimeInstance } from "../domain/knowledge-runtime-instance.js";
import { KnowledgeRuntimeState } from "../domain/knowledge-runtime-state.js";
import { EMPTY_KNOWLEDGE_RUNTIME_STATISTICS } from "../domain/knowledge-runtime-statistics.js";

import { RuntimeContextFactory } from "./runtime-context-factory.js";
import type { CreateRuntimeMetadataInput } from "./runtime-metadata-factory.js";
import { RuntimeMetadataFactory } from "./runtime-metadata-factory.js";
import { RuntimeSessionFactory } from "./runtime-session-factory.js";
import { RuntimeSnapshotFactory } from "./runtime-snapshot-factory.js";
import { RuntimeTokenFactory } from "./runtime-token-factory.js";

export interface CreateKnowledgeRuntimeExecutionInput {
  readonly knowledgeId: string;
  readonly tenantId: string;
  readonly assetNamespace?: string;
  readonly workspaceId?: string;
  readonly context?: CreateKnowledgeRuntimeContextInput;
  readonly metadata?: CreateRuntimeMetadataInput;
}

/**
 * "RUNTIME FACTORY: KnowledgeRuntimeFactory, RuntimeContextFactory, RuntimeSessionFactory,
 * RuntimeSnapshotFactory, RuntimeMetadataFactory, RuntimeTokenFactory."
 * (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) — the top-level façade composing all 5
 * sub-factories as public readonly fields, plus `createExecution()` which builds a fresh,
 * unregistered `KnowledgeRuntimeExecution` in the `CREATED` state (mirroring
 * `@aos/knowledge-engine`'s `KnowledgeFactory` composition pattern).
 */
export class KnowledgeRuntimeFactory {
  readonly context = new RuntimeContextFactory();
  readonly session = new RuntimeSessionFactory();
  readonly snapshot = new RuntimeSnapshotFactory();
  readonly metadata = new RuntimeMetadataFactory();
  readonly token = new RuntimeTokenFactory();

  createExecution(input: CreateKnowledgeRuntimeExecutionInput): KnowledgeRuntimeExecution {
    const token = this.token.create();
    const now = new Date().toISOString();
    const context = this.context.create({
      knowledgeId: input.knowledgeId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      token,
      ...input.context,
    });
    const instance: KnowledgeRuntimeInstance = {
      id: crypto.randomUUID(),
      token,
      knowledgeId: input.knowledgeId,
      assetNamespace: input.assetNamespace,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      state: KnowledgeRuntimeState.CREATED,
      metadata: this.metadata.create(input.metadata),
      statistics: EMPTY_KNOWLEDGE_RUNTIME_STATISTICS,
      createdAt: now,
      updatedAt: now,
    };
    return { instance, context, history: [] };
  }
}
