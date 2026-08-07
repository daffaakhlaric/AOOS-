import { createEmbeddingContext } from "../../src/context/create-embedding-context.js";
import type { EmbeddingContext } from "../../src/context/embedding-context.js";

export function contextFixture(overrides: Partial<EmbeddingContext> = {}): EmbeddingContext {
  return createEmbeddingContext({
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    embeddingId: "embedding-1",
    ...overrides,
  });
}
