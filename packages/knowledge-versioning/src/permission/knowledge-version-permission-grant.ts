import { z } from "zod";

import { KnowledgeVersionOperation } from "../domain/knowledge-version-operation.js";
import { KnowledgeVersionType } from "../domain/knowledge-version-type.js";

/** One registered Permission Grant — evaluated by `KnowledgeVersionPermission#check()` against a Context's `tenantId`/`workspaceId` and, optionally, the target version's `versionType` and the attempted operation. */
export const knowledgeVersionPermissionGrantSchema = z.object({
  id: z.string().min(1),
  scope: z.object({
    tenantId: z.string().min(1),
    workspaceId: z.string().optional(),
    role: z.string().optional(),
  }),
  effect: z.enum(["allow", "deny"]),
  versionType: z.nativeEnum(KnowledgeVersionType).optional(),
  operation: z.nativeEnum(KnowledgeVersionOperation).optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeVersionPermissionGrant = z.infer<typeof knowledgeVersionPermissionGrantSchema>;
