import { z } from "zod";

import { KnowledgeGenerationProviderType } from "./knowledge-generation-provider-type.js";

/**
 * "KnowledgeGenerationResult" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Domain
 * Model") — metadata ABOUT a caller-supplied provider's result, NEVER the generated
 * content itself (this package never generates anything): a content location pointer,
 * a caller-authored summary, and whatever provider-reported metadata the
 * `IKnowledgeGenerationProvider.generate()` interface returned.
 */
export const knowledgeGenerationResultSchema = z.object({
  id: z.string().min(1),
  resultId: z.string().min(1),
  generationId: z.string().min(1),
  providerId: z.string().min(1),
  providerType: z.nativeEnum(KnowledgeGenerationProviderType),
  contentLocation: z.string().optional(),
  summary: z.string().optional(),
  outputMetadata: z.record(z.unknown()),
  completedAt: z.string().datetime(),
});

export type KnowledgeGenerationResult = z.infer<typeof knowledgeGenerationResultSchema>;
