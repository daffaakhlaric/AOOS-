import { createKnowledgeGeneratorContext } from "../../src/context/create-knowledge-generator-context.js";
import type { KnowledgeGeneratorContext } from "../../src/context/knowledge-generator-context.js";

export function contextFixture(
  overrides: Partial<KnowledgeGeneratorContext> = {},
): KnowledgeGeneratorContext {
  return createKnowledgeGeneratorContext({
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    generationId: "generation-1",
    ...overrides,
  });
}
