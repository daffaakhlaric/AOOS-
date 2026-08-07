import { createKnowledgeQualityContext } from "../../src/context/create-knowledge-quality-context.js";
import type { KnowledgeQualityContext } from "../../src/context/knowledge-quality-context.js";

export function contextFixture(
  overrides: Partial<KnowledgeQualityContext> = {},
): KnowledgeQualityContext {
  return createKnowledgeQualityContext({
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    assessmentId: "assessment-1",
    ...overrides,
  });
}
