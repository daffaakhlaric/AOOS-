import type { EmbeddingExecution } from "../../src/domain/embedding-execution.js";
import { EmbeddingModelName } from "../../src/domain/embedding-model-name.js";
import { EmbeddingProviderType } from "../../src/domain/embedding-provider-type.js";
import { EmbeddingState } from "../../src/domain/embedding-state.js";

import { contextFixture } from "./context-fixture.js";

const NOW = "2026-01-01T00:00:00.000Z";

export function executionFixture(overrides: Partial<EmbeddingExecution> = {}): EmbeddingExecution {
  const embeddingId = overrides.instance?.embeddingId ?? "embedding-1";
  const token = overrides.instance?.token ?? "embt_11111111-1111-4111-8111-111111111111";
  return {
    instance: {
      id: embeddingId,
      token,
      embeddingId,
      tenantId: "tenant-1",
      state: EmbeddingState.DRAFT,
      createdAt: NOW,
      updatedAt: NOW,
    },
    context: contextFixture({ embeddingId, token }),
    metadata: {
      id: "meta-1",
      embeddingId,
      title: "Test Embedding",
      tenantId: "tenant-1",
      tags: [],
      createdAt: NOW,
      updatedAt: NOW,
    },
    request: {
      id: "req-1",
      requestId: "req-1",
      embeddingId,
      tenantId: "tenant-1",
      textReference: "text-ref-1",
      providerType: EmbeddingProviderType.OPENAI,
      modelName: EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
      requestedBy: "user-1",
      createdAt: NOW,
    },
    resultMetadata: [],
    history: [],
    auditTrail: [],
    logs: [],
    ...overrides,
  };
}
