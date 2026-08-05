import { z } from "zod";

import { KnowledgeSourceCategory } from "../domain/knowledge-source-category.js";

/** One registered Source Policy — evaluated against a `KnowledgeSourceMetadataRecord`'s `sourceCategory` and scope by `KnowledgeSourcePolicy`. */
export const knowledgeSourcePolicyRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scope: z.object({
    tenantId: z.string().min(1),
    workspaceId: z.string().optional(),
  }),
  enabled: z.boolean(),
  allowedCategories: z.array(z.nativeEnum(KnowledgeSourceCategory)).optional(),
  deniedCategories: z.array(z.nativeEnum(KnowledgeSourceCategory)).optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeSourcePolicyRecord = z.infer<typeof knowledgeSourcePolicyRecordSchema>;

export interface KnowledgeSourcePolicyViolation {
  readonly policyId: string;
  readonly reason: string;
}
