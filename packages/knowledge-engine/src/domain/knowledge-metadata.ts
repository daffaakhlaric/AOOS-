import { z } from "zod";

import { KnowledgeClassification } from "./knowledge-classification.js";

/** "KNOWLEDGE METADATA" (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — the exact field list from the prompt. */
export const knowledgeMetadataSchema = z.object({
  author: z.string().optional(),
  department: z.string().optional(),
  owner: z.string().optional(),
  tenant: z.string().optional(),
  workspace: z.string().optional(),
  language: z.string().optional(),
  region: z.string().optional(),
  industry: z.string().optional(),
  tags: z.array(z.string()),
  keywords: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  reviewedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  source: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  classification: z.nativeEnum(KnowledgeClassification),
  priority: z.number().int().min(0).optional(),
  custom: z.record(z.unknown()),
});

export type KnowledgeMetadata = z.infer<typeof knowledgeMetadataSchema>;

/** "Metrics: ... Storage Statistics." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — per-Asset usage statistics, updated by `catalog/`/`repository/` on access. */
export const knowledgeStatisticsSchema = z.object({
  viewCount: z.number().int().min(0),
  usageCount: z.number().int().min(0),
  referenceCount: z.number().int().min(0),
  versionCount: z.number().int().min(0),
  sizeBytes: z.number().int().min(0).optional(),
  lastAccessedAt: z.string().datetime().optional(),
});

export type KnowledgeStatistics = z.infer<typeof knowledgeStatisticsSchema>;

export const EMPTY_KNOWLEDGE_STATISTICS: KnowledgeStatistics = {
  viewCount: 0,
  usageCount: 0,
  referenceCount: 0,
  versionCount: 0,
};
