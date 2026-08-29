import { AdAngle } from "@aos/meta-ads-agent";
import { Branch } from "@aos/meta-ads-connector";
import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * `CreativeFormat`/`CreativeUrgency` (`packages/meta-ads-agent/src/types/AgentTypes.ts`) are not
 * re-exported from `@aos/meta-ads-agent`'s public `index.ts` (its `package.json` `exports` field
 * only publishes the package root, and that root never re-exports these two type aliases) — so
 * they cannot be imported here. Their literal members are copied verbatim from `AgentTypes.ts` as
 * local Zod enums instead, kept in sync manually; `AdAngle`/`Branch` ARE real runtime enums
 * exported from their packages, so those are imported and validated directly (coordinator note
 * #4 — fail closed on a hallucinated angle/branch, never pass one through silently).
 */
const CreativeFormatSchema = z.enum(["VIDEO_15S", "VIDEO_30S", "IMAGE_SQUARE", "IMAGE_STORY"]);
const CreativeUrgencySchema = z.enum(["HIGH", "MEDIUM", "LOW"]);

/**
 * `POST /api/v1/llm/creative-brief` request body — per the spec's `{ ad: {...}, angle: string,
 * branch: string }`. `ad` is deliberately a loose prompt-context bag (name + optional metrics),
 * not the full `AdResponseDto` — the caller only needs to describe the ad to Samantha for the
 * prompt, whereas the endpoint's RESPONSE is what must validate against the real `CreativeBrief`
 * entity's value objects (coordinator note #4). `angle`/`branch` here are optional hints the
 * dashboard already has context for (e.g. "refresh this ad, historically a DP_RINGAN angle") — the
 * model is free to propose a different angle in its response, which is then validated against the
 * real `AdAngle` enum regardless of what was hinted.
 */
export const CreativeBriefAdContextSchema = z.object({
  name: z.string().min(1),
  branch: z.nativeEnum(Branch).optional(),
  metrics: z
    .object({
      spend: z.number().optional(),
      frequency: z.number().optional(),
      totalLead: z.number().optional(),
    })
    .partial()
    .optional(),
});

export const CreativeBriefRequestSchema = z.object({
  ad: CreativeBriefAdContextSchema,
  angle: z.nativeEnum(AdAngle).optional(),
  branch: z.nativeEnum(Branch),
});
export type CreativeBriefRequestDto = z.infer<typeof CreativeBriefRequestSchema>;

/**
 * The shape Samantha's `creative-brief` system prompt asks the model to return. `angle`/`branch` are
 * validated against the real `AdAngle`/`Branch` enums (coordinator note #4) — an LLM response with
 * an invalid/hallucinated value fails Zod validation and `LlmService` treats it as
 * `available: false, reason: "INVALID_RESPONSE"`, never passed through.
 */
export const CreativeBriefLlmPayloadSchema = z.object({
  unit: z.string().min(1),
  angle: z.nativeEnum(AdAngle),
  branch: z.nativeEnum(Branch),
  primaryMessage: z.string().min(1),
  tone: z.string().min(1),
  formats: z.array(CreativeFormatSchema).min(1),
  avoid: z.array(z.string()),
  urgency: CreativeUrgencySchema,
});
export type CreativeBriefLlmPayload = z.infer<typeof CreativeBriefLlmPayloadSchema>;

export type CreativeBriefResponseDto =
  ({ readonly available: true } & CreativeBriefLlmPayload) | LlmUnavailableResponseDto;
