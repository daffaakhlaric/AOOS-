import { z } from "zod";

import { KnowledgeQualityDimension } from "./knowledge-quality-dimension.js";

/**
 * "KnowledgeQualityRule" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Domain Model") — a
 * named check definition: metadata only, no executable rule logic. This package NEVER
 * evaluates a Rule itself — Rule execution belongs entirely to a caller-supplied
 * `IKnowledgeQualityRuleProvider`. Registered in the RULE Registry bucket keyed by
 * `ruleId`.
 */
export const knowledgeQualityRuleSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  tenantId: z.string().min(1),
  dimension: z.nativeEnum(KnowledgeQualityDimension),
  severity: z.enum(["info", "low", "medium", "high", "critical"]).default("medium"),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KnowledgeQualityRule = z.infer<typeof knowledgeQualityRuleSchema>;
