import { z } from "zod";

import { KnowledgeValidationCategory } from "./knowledge-validation-category.js";

/**
 * "KnowledgeValidationRule" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Domain
 * Model") — a named check definition: metadata only, no executable rule logic. This
 * package NEVER evaluates a Rule itself — Rule execution belongs entirely to a
 * caller-supplied `IKnowledgeValidationRuleProvider`. Registered in the RULE Registry
 * bucket keyed by `ruleId`.
 */
export const knowledgeValidationRuleSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  tenantId: z.string().min(1),
  category: z.nativeEnum(KnowledgeValidationCategory),
  severity: z.enum(["info", "low", "medium", "high", "critical"]).default("medium"),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KnowledgeValidationRule = z.infer<typeof knowledgeValidationRuleSchema>;
