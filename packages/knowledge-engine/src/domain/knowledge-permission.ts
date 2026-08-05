import { z } from "zod";

import { knowledgeScopeSchema } from "./knowledge-scope.js";

/** "PERMISSION ENGINE: Role Based, Policy Based, Department, Workspace, Solution Pack, Tenant, Organization, Environment." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md). */
export const knowledgePermissionSubjectTypeSchema = z.enum(["role", "user", "policy"]);
export type KnowledgePermissionSubjectType = z.infer<typeof knowledgePermissionSubjectTypeSchema>;

export const knowledgePermissionEffectSchema = z.enum(["allow", "deny"]);
export type KnowledgePermissionEffect = z.infer<typeof knowledgePermissionEffectSchema>;

export const knowledgePermissionSchema = z.object({
  id: z.string().min(1),
  subjectType: knowledgePermissionSubjectTypeSchema,
  subjectId: z.string().min(1),
  action: z.string().min(1),
  effect: knowledgePermissionEffectSchema,
  scope: knowledgeScopeSchema,
  environment: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgePermission = z.infer<typeof knowledgePermissionSchema>;
