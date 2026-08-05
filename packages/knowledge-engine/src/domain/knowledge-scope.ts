import { z } from "zod";

/**
 * "KNOWLEDGE WORKSPACE ... Support complete isolation." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md)
 * — the hierarchical ownership chain every `KnowledgeAsset` carries: Organization → Tenant
 * → Workspace → Department → Team → Solution Pack → Project → Knowledge Library. Only
 * `tenantId` is required; every narrower level is optional (an asset can live at Tenant
 * level, or be narrowed all the way down to one Library).
 */
export const knowledgeScopeSchema = z.object({
  organizationId: z.string().min(1).optional(),
  tenantId: z.string().min(1),
  workspaceId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
  solutionPackId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  libraryId: z.string().min(1).optional(),
});

export type KnowledgeScope = z.infer<typeof knowledgeScopeSchema>;

/** Returns whether `narrower` is at least as specific as `broader` at every level `broader` sets — used to check "does this Policy/Permission scope cover this Asset's scope." */
export function scopeContains(broader: KnowledgeScope, narrower: KnowledgeScope): boolean {
  const keys: readonly (keyof KnowledgeScope)[] = [
    "organizationId",
    "tenantId",
    "workspaceId",
    "departmentId",
    "teamId",
    "solutionPackId",
    "projectId",
    "libraryId",
  ];
  return keys.every((key) => broader[key] === undefined || broader[key] === narrower[key]);
}
