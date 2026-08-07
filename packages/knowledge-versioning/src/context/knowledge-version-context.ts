import { z } from "zod";

/**
 * "KnowledgeVersionContext" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Public API")
 * — the caller-scoped execution context every Version Operation runs under. `token` is
 * the `KnowledgeVersionToken` addressing the target version instance; the
 * tenant/workspace/organization/department/environment/namespace fields mirror the
 * multi-tenancy context shape established by the sibling Knowledge packages.
 */
export const knowledgeVersionContextSchema = z.object({
  token: z.string().min(1),
  versionId: z.string().min(1),
  assetId: z.string().min(1),
  branchId: z.string().optional(),
  workspaceId: z.string().optional(),
  tenantId: z.string().min(1),
  organizationId: z.string().optional(),
  departmentId: z.string().optional(),
  environment: z.string().optional(),
  namespace: z.string().optional(),
  policy: z.string().optional(),
  permission: z.string().optional(),
  metadata: z.record(z.unknown()),
  traceId: z.string().optional(),
  correlationId: z.string().min(1),
});

export type KnowledgeVersionContext = z.infer<typeof knowledgeVersionContextSchema>;
