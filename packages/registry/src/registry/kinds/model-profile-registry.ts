import { z } from "zod";

import { baseManifestSchema } from "../../contracts/base-manifest.js";
import { RegistryKind } from "../../contracts/registry-kind.js";
import type { RegistryEventEmitter } from "../../events/registry-event-emitter.js";
import { Registry } from "../registry.js";

/**
 * Model Profile manifest (docs/PROMPT-005.3A-REGISTRY-ENHANCEMENT.md Enhancement 7) —
 * distinct from the existing Model Registry (`model-registry.ts`, routing config: provider/
 * context_window/cost_tier). A Model Profile is a benchmark-and-pricing record used to pick
 * between models (e.g. Claude, GPT, Gemini, KIE, OpenRouter, DeepSeek, Ollama, Bedrock, Azure
 * OpenAI, Vertex AI). No AI Gateway exists yet; this is manifest metadata only.
 */
const scoreSchema = z.number().min(0).max(100);

export const modelProfileManifestSchema = baseManifestSchema.extend({
  provider: z.string().min(1),
  reasoning_score: scoreSchema.optional(),
  coding_score: scoreSchema.optional(),
  vision_score: scoreSchema.optional(),
  image_score: scoreSchema.optional(),
  video_score: scoreSchema.optional(),
  /** Median latency in milliseconds for a representative request. */
  latency_ms: z.number().positive().optional(),
  pricing: z
    .object({
      inputPerMillionTokens: z.number().nonnegative().optional(),
      outputPerMillionTokens: z.number().nonnegative().optional(),
      currency: z.string().default("USD").optional(),
    })
    .optional(),
  context_window: z.number().int().positive().optional(),
  recommended_use: z.array(z.string()).optional(),
  /** Model Profile Registry entry id to fall back to if this one is unavailable/rate-limited. */
  fallback: z.string().optional(),
});

export type ModelProfileManifest = z.infer<typeof modelProfileManifestSchema>;

export function createModelProfileRegistry(
  events?: RegistryEventEmitter,
): Registry<ModelProfileManifest> {
  return new Registry<ModelProfileManifest>({
    kind: RegistryKind.MODEL_PROFILE,
    schema: modelProfileManifestSchema,
    events,
  });
}
