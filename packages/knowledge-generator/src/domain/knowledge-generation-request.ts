import { z } from "zod";

import { KnowledgeGenerationAssetType } from "./knowledge-generation-asset-type.js";
import { KnowledgeGenerationMode } from "./knowledge-generation-mode.js";
import { KnowledgeGenerationProviderType } from "./knowledge-generation-provider-type.js";

/**
 * "KnowledgeGenerationRequest" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Domain
 * Model") — the input to a Generation: which Knowledge Type, which Generation Mode,
 * which Prompt Reference, which Context Reference, which Policy, and which Provider
 * Type is desired. Never carries the prompt text or the source content itself.
 */
export const knowledgeGenerationRequestSchema = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1),
  generationId: z.string().min(1),
  assetType: z.nativeEnum(KnowledgeGenerationAssetType),
  mode: z.nativeEnum(KnowledgeGenerationMode),
  providerType: z.nativeEnum(KnowledgeGenerationProviderType),
  promptReferenceId: z.string().optional(),
  contextReferenceId: z.string().optional(),
  policyId: z.string().optional(),
  configurationId: z.string().optional(),
  requestedBy: z.string().min(1),
  instructions: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeGenerationRequest = z.infer<typeof knowledgeGenerationRequestSchema>;
