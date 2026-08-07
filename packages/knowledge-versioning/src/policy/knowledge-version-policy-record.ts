import { z } from "zod";

import { KnowledgeBranchType } from "../domain/knowledge-branch-type.js";
import { KnowledgeVersionType } from "../domain/knowledge-version-type.js";

/** One registered Version Policy — evaluated against a version's `versionType` (and, when branch context is known, its branch's `branchType`) by `KnowledgeVersionPolicy`. */
export const knowledgeVersionPolicyRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scope: z.object({
    tenantId: z.string().min(1),
    workspaceId: z.string().optional(),
  }),
  enabled: z.boolean(),
  allowedVersionTypes: z.array(z.nativeEnum(KnowledgeVersionType)).optional(),
  deniedVersionTypes: z.array(z.nativeEnum(KnowledgeVersionType)).optional(),
  allowedBranchTypes: z.array(z.nativeEnum(KnowledgeBranchType)).optional(),
  deniedBranchTypes: z.array(z.nativeEnum(KnowledgeBranchType)).optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeVersionPolicyRecord = z.infer<typeof knowledgeVersionPolicyRecordSchema>;

export interface KnowledgeVersionPolicyViolation {
  readonly policyId: string;
  readonly reason: string;
}
