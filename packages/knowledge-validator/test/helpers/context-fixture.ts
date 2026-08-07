import { createKnowledgeValidatorContext } from "../../src/context/create-knowledge-validator-context.js";
import type { KnowledgeValidatorContext } from "../../src/context/knowledge-validator-context.js";

export function contextFixture(
  overrides: Partial<KnowledgeValidatorContext> = {},
): KnowledgeValidatorContext {
  return createKnowledgeValidatorContext({
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
    validationId: "validation-1",
    ...overrides,
  });
}
