import { z } from "zod";

import type { LlmUnavailableResponseDto } from "./llm-unavailable.dto.js";

export const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1),
});

/** `POST /api/v1/llm/chat` request body — per the spec's `{ messages: [{role, content}], context: string }`. */
export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1, "messages must contain at least one message"),
  context: z.string().optional(),
});
export type ChatRequestDto = z.infer<typeof ChatRequestSchema>;

/**
 * A free-text reply, not a JSON-mode endpoint (coordinator note #5 only requires defensive
 * JSON-mode parsing for the two JSON-returning endpoints, `analyze`/`creative-brief`) — so there
 * is no schema to validate the model's output against beyond "OpenAI returned a non-empty string",
 * already guaranteed by `OpenAiClient.createChatCompletion`'s `Result` contract.
 */
export type ChatResponseDto =
  { readonly available: true; readonly reply: string } | LlmUnavailableResponseDto;
