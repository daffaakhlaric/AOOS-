import { z } from "zod";

import { KnowledgeGenerationProviderType } from "./knowledge-generation-provider-type.js";

/**
 * "KnowledgeGenerationConfiguration" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md —
 * "Domain Model") — generation-run tuning metadata handed to a caller-supplied provider
 * through the `IKnowledgeGenerationProvider` interface. This package never interprets
 * `maxTokens`/`temperature` itself — it only validates/records them.
 */
export const knowledgeGenerationConfigurationSchema = z.object({
  id: z.string().min(1),
  configurationId: z.string().min(1),
  generationId: z.string().min(1),
  providerType: z.nativeEnum(KnowledgeGenerationProviderType).optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  timeoutMs: z.number().int().positive().optional(),
  retries: z.number().int().min(0).max(10).optional(),
  custom: z.record(z.unknown()),
  createdAt: z.string().datetime(),
});

export type KnowledgeGenerationConfiguration = z.infer<
  typeof knowledgeGenerationConfigurationSchema
>;
