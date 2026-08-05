import { z } from "zod";

import { KnowledgeProviderCategory } from "../domain/knowledge-provider-category.js";

/** One registered Provider Policy — evaluated against a `ProviderMetadataRecord`'s `providerCategory` and scope by `KnowledgeProviderPolicy`. */
export const knowledgeProviderPolicyRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scope: z.object({
    tenantId: z.string().min(1),
    workspaceId: z.string().optional(),
  }),
  enabled: z.boolean(),
  allowedCategories: z.array(z.nativeEnum(KnowledgeProviderCategory)).optional(),
  deniedCategories: z.array(z.nativeEnum(KnowledgeProviderCategory)).optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeProviderPolicyRecord = z.infer<typeof knowledgeProviderPolicyRecordSchema>;

export interface KnowledgeProviderPolicyViolation {
  readonly policyId: string;
  readonly reason: string;
}
