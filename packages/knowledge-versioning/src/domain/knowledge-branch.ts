import { z } from "zod";

import { KnowledgeBranchType } from "./knowledge-branch-type.js";

/**
 * "KnowledgeBranch" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Domain Model") — one
 * named line of versions for a Knowledge Asset, typed by the 7 `KnowledgeBranchType`
 * values. `sourceBranchId` records which branch this one was forked from;
 * `headVersionId` records the branch's current head version — both pure metadata
 * references.
 */
export const knowledgeBranchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  branchType: z.nativeEnum(KnowledgeBranchType),
  assetId: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  sourceBranchId: z.string().optional(),
  headVersionId: z.string().optional(),
  createdBy: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeBranch = z.infer<typeof knowledgeBranchSchema>;
