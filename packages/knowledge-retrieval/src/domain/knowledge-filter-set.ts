import {
  KnowledgeAssetType,
  KnowledgeClassification,
  KnowledgeLifecycleState,
} from "@aos/knowledge-engine";
import { z } from "zod";

/**
 * "FILTERING: Permission, Policy, Workspace, Department, Tenant, Classification,
 * Language, Region, Category, Tags, Version, Template, Source, Asset Type, Lifecycle."
 * (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md) — the exact field list from the prompt.
 * Permission/Policy are declared here for completeness but are never applied by
 * `KnowledgeFilter` itself — that would duplicate `KnowledgePermissionResolver`/
 * `KnowledgePolicyResolver`'s own job; see `filter/knowledge-filter.ts`.
 */
export const knowledgeFilterSetSchema = z.object({
  permission: z.string().optional(),
  policy: z.string().optional(),
  workspaceId: z.string().optional(),
  departmentId: z.string().optional(),
  tenantId: z.string().optional(),
  classification: z.nativeEnum(KnowledgeClassification).optional(),
  language: z.string().optional(),
  region: z.string().optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  version: z.string().optional(),
  templateId: z.string().optional(),
  source: z.string().optional(),
  assetType: z.nativeEnum(KnowledgeAssetType).optional(),
  lifecycleState: z.nativeEnum(KnowledgeLifecycleState).optional(),
});

export type KnowledgeFilterSet = z.infer<typeof knowledgeFilterSetSchema>;

export const EMPTY_KNOWLEDGE_FILTER_SET: KnowledgeFilterSet = {};
