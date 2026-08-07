import { z } from "zod";

import { KnowledgeVersionType } from "./knowledge-version-type.js";

/**
 * "KnowledgeVersionMetadata" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Domain
 * Model") — the descriptive metadata record for one Knowledge Asset version. "This
 * package owns ONLY: ... Version metadata" — no asset content, no file references, no
 * secrets appear anywhere in this record. `dependencies` declares other version ids this
 * version depends on — a pure metadata reference list checked by the Validator's
 * Dependency stage, never dereferenced into content.
 */
export const knowledgeVersionMetadataSchema = z.object({
  versionId: z.string().min(1),
  assetId: z.string().min(1),
  versionName: z.string().optional(),
  versionDescription: z.string().optional(),
  versionType: z.nativeEnum(KnowledgeVersionType),
  versionNumber: z.string().min(1),
  branchId: z.string().optional(),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  labels: z.array(z.string()),
  tags: z.array(z.string()),
  dependencies: z.array(z.string().min(1)),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KnowledgeVersionMetadata = z.infer<typeof knowledgeVersionMetadataSchema>;
