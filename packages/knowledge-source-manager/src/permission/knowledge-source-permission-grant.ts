import { z } from "zod";

import { KnowledgeSourceCategory } from "../domain/knowledge-source-category.js";

/** One registered Permission Grant — evaluated by `KnowledgeSourcePermission#check()` against a Context's `tenantId`/`workspaceId`/role and, optionally, the target Source's `namespace`/`category`. */
export const knowledgeSourcePermissionGrantSchema = z.object({
  id: z.string().min(1),
  scope: z.object({
    tenantId: z.string().min(1),
    workspaceId: z.string().optional(),
    role: z.string().optional(),
  }),
  effect: z.enum(["allow", "deny"]),
  namespace: z.string().optional(),
  category: z.nativeEnum(KnowledgeSourceCategory).optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeSourcePermissionGrant = z.infer<typeof knowledgeSourcePermissionGrantSchema>;
