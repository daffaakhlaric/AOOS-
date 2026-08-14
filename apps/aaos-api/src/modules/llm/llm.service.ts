import type { IRateLimiter } from "@aos/meta-ads-connector";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import {
  AAOS_API_CONFIG,
  LLM_OPENAI_CLIENT,
  LLM_RATE_LIMITER,
  LLM_RESPONSE_CACHE,
} from "../../di-tokens.js";

import type { ResponseCache } from "./cache/ResponseCache.js";
import {
  AnalyzeLlmPayloadSchema,
  type AnalyzeRequestDto,
  type AnalyzeResponseDto,
} from "./dto/analyze.dto.js";
import type { ChatRequestDto, ChatResponseDto } from "./dto/chat.dto.js";
import {
  CreativeBriefLlmPayloadSchema,
  type CreativeBriefRequestDto,
  type CreativeBriefResponseDto,
} from "./dto/creative-brief.dto.js";
import { unavailable, type LlmUnavailableResponseDto } from "./dto/llm-unavailable.dto.js";
import type { OpenAiChatMessage, OpenAiClient } from "./infrastructure/OpenAiClient.js";

/** Verbatim system prompt from the spec's `POST /api/v1/llm/analyze` section. */
const ANALYZE_SYSTEM_PROMPT = `Kamu adalah Tamara, AI Marketing Manager untuk DSS Motor (Mobix)
— dealer mobil bekas di Indonesia.

Tugasmu: analisa data iklan Meta Ads dan berikan rekomendasi
dalam Bahasa Indonesia yang jelas dan actionable.

Format response JSON:
{
  "temuan": [
    { "icon": "🔴", "judul": "...", "detail": "..." },
    { "icon": "🟢", "judul": "...", "detail": "..." }
  ],
  "rekomendasi": [
    { "aksi": "SCALE/PAUSE/FIX/KEEP", "target": "#C001 nama iklan", "alasan": "...", "estimasi": "hemat Rp X atau tambah X lead" }
  ],
  "ringkasan": "Satu paragraf ringkasan kondisi iklan saat ini"
}`;

/** Verbatim system prompt from the spec's `POST /api/v1/llm/creative-brief` section. */
const CREATIVE_BRIEF_SYSTEM_PROMPT = `Kamu adalah Tamara, AI Marketing Manager untuk DSS Motor (Mobix).
Kamu sedang brief Kai (Creative AI) untuk membuat iklan baru.

Berikan brief dalam format JSON:
{
  "unit": "nama unit mobil",
  "angle": "DP_RINGAN/KREDIT_SYARIAH/GUDANGNYA/QNA/DISCOVERY/TESTIMONIAL",
  "branch": "BINTARO/CINERE/UMUM/BANDUNG",
  "primaryMessage": "pesan utama dalam bahasa Indonesia",
  "tone": "casual, relatable",
  "formats": ["VIDEO_15S", "IMAGE_SQUARE"],
  "avoid": ["hal yang harus dihindari"],
  "urgency": "HIGH/MEDIUM/LOW"
}`;

/** Not a literal spec quote (the spec's `/llm/chat` section has no system-prompt block of its own) — derived from the same "Kamu adalah Tamara..." persona used by the other two prompts, for general free-text conversation. */
const CHAT_SYSTEM_PROMPT =
  "Kamu adalah Tamara, AI Marketing Manager untuk DSS Motor (Mobix) — dealer mobil bekas di Indonesia. Jawab pertanyaan dengan jelas, actionable, dan dalam Bahasa Indonesia.";

/**
 * OpenAI-backed implementation of Tamara's `analyze`/`creativeBrief`/`chat` capabilities
 * (`src/modules/llm/llm.controller.ts`'s three endpoints). Every method follows the same shape:
 *
 * 1. Serve from `ResponseCache` if an identical request body was already answered within the last
 *    30 minutes (spec Section 6 — cache hits never touch the rate limiter or OpenAI).
 * 2. Gate on `OPENAI_API_KEY` configured + local rate-limit budget (spec Sections 6 + 7).
 * 3. Call OpenAI via `OpenAiClient`; on any failure (network, non-2xx, malformed/invalid JSON),
 *    return a typed `available: false` fallback DTO — NEVER throw, so the dashboard always gets a
 *    200 response it can branch on to fall back to rule-based analysis (spec Section 7).
 */
@Injectable()
export class LlmService {
  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(LLM_OPENAI_CLIENT) private readonly client: OpenAiClient,
    @Inject(LLM_RATE_LIMITER) private readonly rateLimiter: IRateLimiter,
    @Inject(LLM_RESPONSE_CACHE) private readonly cache: ResponseCache<unknown>,
  ) {}

  async analyze(body: AnalyzeRequestDto): Promise<AnalyzeResponseDto> {
    const cached = this.cache.get("analyze", body) as AnalyzeResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: ANALYZE_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(body) },
      ],
      jsonMode: true,
    });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const parsed = safeJsonParse(completion.value);
    const validated = parsed === undefined ? undefined : AnalyzeLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      return unavailable("INVALID_RESPONSE");
    }

    const response: AnalyzeResponseDto = { available: true, ...validated.data };
    this.cache.set("analyze", body, response);
    return response;
  }

  async creativeBrief(body: CreativeBriefRequestDto): Promise<CreativeBriefResponseDto> {
    const cached = this.cache.get("creative-brief", body) as CreativeBriefResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: CREATIVE_BRIEF_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(body) },
      ],
      jsonMode: true,
    });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const parsed = safeJsonParse(completion.value);
    const validated =
      parsed === undefined ? undefined : CreativeBriefLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      return unavailable("INVALID_RESPONSE");
    }

    const response: CreativeBriefResponseDto = { available: true, ...validated.data };
    this.cache.set("creative-brief", body, response);
    return response;
  }

  async chat(body: ChatRequestDto): Promise<ChatResponseDto> {
    const cached = this.cache.get("chat", body) as ChatResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemContent = body.context
      ? `${CHAT_SYSTEM_PROMPT}\n\nKonteks: ${body.context}`
      : CHAT_SYSTEM_PROMPT;
    const messages: OpenAiChatMessage[] = [
      { role: "system", content: systemContent },
      ...body.messages,
    ];

    const completion = await this.client.createChatCompletion({ messages });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const response: ChatResponseDto = { available: true, reply: completion.value };
    this.cache.set("chat", body, response);
    return response;
  }

  /** Shared "no API key" / "rate limited" checks (spec Sections 6 + 7). Returns `undefined` when clear to call OpenAI. */
  private checkGate(): LlmUnavailableResponseDto | undefined {
    if (this.config.OPENAI_API_KEY.length === 0) {
      return unavailable("NO_API_KEY");
    }
    const consumeResult = this.rateLimiter.tryConsume();
    if (!consumeResult.ok) {
      return unavailable("RATE_LIMITED");
    }
    return undefined;
  }
}

/** `JSON.parse` defensively — coordinator note #5: an LLM occasionally returns malformed JSON even in `response_format: json_object` mode. */
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
