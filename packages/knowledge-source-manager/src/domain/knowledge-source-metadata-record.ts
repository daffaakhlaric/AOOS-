import { z } from "zod";

import { KnowledgeSourceCategory } from "./knowledge-source-category.js";

/**
 * "SOURCE METADATA: SourceId, SourceName, SourceDescription, SourceCategory,
 * SourceProvider, ProviderId, ProviderVersion, Namespace, Collection, WorkspaceId,
 * TenantId, OrganizationId, DepartmentId, Labels, Tags, Priority, Policy, Permission,
 * Environment, Owner, CreatedBy, UpdatedBy, CreatedAt, UpdatedAt."
 * (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md) — the exact 24-field list from the
 * prompt. Judgment call: `sourceProvider` and `providerId` are distinct fields on
 * purpose — `sourceProvider` is the human-readable provider label a tenant sees (e.g.
 * "Google Drive"), while `providerId` is the canonical identifier of the registered
 * `@aos/knowledge-provider` definition this Source was created from. No secrets, no
 * OAuth, no API client settings appear anywhere in this record.
 */
export const knowledgeSourceMetadataRecordSchema = z.object({
  sourceId: z.string().min(1),
  sourceName: z.string().min(1),
  sourceDescription: z.string().optional(),
  sourceCategory: z.nativeEnum(KnowledgeSourceCategory),
  sourceProvider: z.string().min(1),
  providerId: z.string().min(1),
  providerVersion: z.string().optional(),
  namespace: z.string().optional(),
  collection: z.string().optional(),
  workspaceId: z.string().optional(),
  tenantId: z.string().min(1),
  organizationId: z.string().optional(),
  departmentId: z.string().optional(),
  labels: z.array(z.string()),
  tags: z.array(z.string()),
  priority: z.number().int().nonnegative(),
  policy: z.string().optional(),
  permission: z.string().optional(),
  environment: z.string().optional(),
  owner: z.string().optional(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KnowledgeSourceMetadataRecord = z.infer<typeof knowledgeSourceMetadataRecordSchema>;
