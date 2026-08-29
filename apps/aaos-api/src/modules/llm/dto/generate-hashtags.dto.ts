import { z } from "zod";

import { SosmedVerticalSchema } from "./generate-caption.dto.js";
import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

/**
 * `LlmService.generateHashtags` request — mirrors the spec's `HASHTAG_PROMPT` inputs (brand,
 * location/branch, product name), plus `vertical` so the prompt can tune generic hashtags
 * (otomotif vs properti) the same way `generateCaption` does.
 */
export const GenerateHashtagsRequestSchema = z.object({
  productName: z.string().min(1),
  brand: z.string().min(1),
  location: z.string().min(1),
  vertical: SosmedVerticalSchema,
});
export type GenerateHashtagsRequestDto = z.infer<typeof GenerateHashtagsRequestSchema>;

/**
 * One hashtag, `#`-prefixed with no internal whitespace — matches the spec's own "Format: satu
 * baris, pisahkan spasi, mulai dengan #" instruction, enforced here rather than trusted from the
 * model's free text.
 */
const HashtagSchema = z.string().regex(/^#\S+$/, "hashtag must start with # and contain no spaces");

/**
 * The shape Samantha's hashtag-generation system prompt asks the model to return — 8 to 12
 * hashtags, per the spec's "Generate 8-12 hashtag relevan" instruction. A response outside that
 * range fails Zod validation and is treated as `INVALID_RESPONSE` (fail closed, same discipline
 * as every other `LlmService` method — never silently truncate/pad what the model returned).
 */
export const GenerateHashtagsLlmPayloadSchema = z.object({
  hashtags: z.array(HashtagSchema).min(8).max(12),
});
export type GenerateHashtagsLlmPayload = z.infer<typeof GenerateHashtagsLlmPayloadSchema>;

export type GenerateHashtagsResponseDto =
  ({ readonly available: true } & GenerateHashtagsLlmPayload) | LlmUnavailableResponseDto;
