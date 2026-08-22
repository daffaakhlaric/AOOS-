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
import {
  GenerateCaptionLlmPayloadSchema,
  type GenerateCaptionRequestDto,
  type GenerateCaptionResponseDto,
} from "./dto/generate-caption.dto.js";
import {
  GenerateHashtagsLlmPayloadSchema,
  type GenerateHashtagsRequestDto,
  type GenerateHashtagsResponseDto,
} from "./dto/generate-hashtags.dto.js";
import { unavailable, type LlmUnavailableResponseDto } from "./dto/llm-unavailable.dto.js";
import {
  SelectTargetingLlmPayloadSchema,
  type SelectTargetingRequestDto,
  type SelectTargetingResponseDto,
} from "./dto/select-targeting.dto.js";
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

/**
 * AAOS-SIMULASI-TARGETING. Not a spec quote — this capability did not exist before this task.
 * Written in the same "Kamu adalah Tamara…" persona as the two prompts above, and worded to make
 * the candidate constraint explicit in the prompt itself (belt) on top of the server-side
 * candidate-set intersection in `selectTargeting` (braces — the prompt is a request, the
 * intersection is the guarantee).
 */
const SELECT_TARGETING_SYSTEM_PROMPT = `Kamu adalah Tamara, AI Marketing Manager untuk DSS Motor (Mobix) — dealer mobil bekas di Indonesia.

Kamu diberi DAFTAR KANDIDAT interest Meta Ads yang nyata (hasil pencarian langsung ke Meta Graph API).
Tugasmu: pilih 2-5 interest dari daftar itu yang paling relevan untuk menjual unit yang disebutkan.

ATURAN KERAS:
- HANYA boleh memilih "id" yang ADA di daftar kandidat. Dilarang mengarang id baru.
- Jangan memilih semua kandidat — pilih yang benar-benar relevan saja.
- "reasoning" ditulis dalam Bahasa Indonesia, satu atau dua kalimat.

Format response JSON:
{
  "interestIds": ["<id dari daftar kandidat>", "..."],
  "reasoning": "alasan singkat dalam Bahasa Indonesia"
}`;

/** Not a literal spec quote (the spec's `/llm/chat` section has no system-prompt block of its own) — derived from the same "Kamu adalah Tamara..." persona used by the other two prompts, for general free-text conversation. */
const CHAT_SYSTEM_PROMPT =
  "Kamu adalah Tamara, AI Marketing Manager untuk DSS Motor (Mobix) — dealer mobil bekas di Indonesia. Jawab pertanyaan dengan jelas, actionable, dan dalam Bahasa Indonesia.";

/**
 * AAOS-SOSMED-AUTOMATION Phase 1. NOT a verbatim copy of the spec's `CAPTION_SYSTEM_PROMPT`
 * template literal — that template interpolates `tenant.name`/`vertical`/`productData` directly
 * into the system prompt string, which is a different LLM-calling convention than every other
 * method on this service uses. Every real method here (`analyze`/`creativeBrief`/`selectTargeting`)
 * instead keeps the system prompt STATIC (persona + task + output format only) and sends the
 * per-request variable data as `JSON.stringify(body)` in the user message — so this prompt follows
 * that same real, established shape rather than inventing a second one.
 */
const GENERATE_CAPTION_SYSTEM_PROMPT = `Kamu adalah Tamara, Social Media Manager untuk tenant AAOS.

Tugas: buat DUA caption untuk posting organik dari satu brief konten (JSON di pesan user):
- contentType: tipe konten (PROMO/EDUKASI/TESTIMONI/BTS/TIPS/MARKET_UPDATE)
- productRef: deskripsi produk/unit/listing yang jadi bahan konten
- angle: sudut pandang/pesan utama
- tone: FRIENDLY/PROFESSIONAL/EXCITED/INFORMATIVE
- vertical: AUTOMOTIVE (dealer mobil bekas) atau PROPERTY (agen properti)

PANDUAN:
- Bahasa Indonesia yang natural, sesuai tone yang diminta
- Selalu ada call to action (chat, DM, kunjungi)
- Sertakan emoji yang relevan, tidak berlebihan
- instagramCaption: ringkas, maksimal sekitar 300 karakter sebelum "more"
- facebookCaption: lebih panjang, gaya storytelling
- JANGAN sertakan hashtag di caption — hashtag dibuat lewat endpoint terpisah

Format response JSON:
{
  "instagramCaption": "...",
  "facebookCaption": "..."
}`;

/**
 * AAOS-SOSMED-AUTOMATION Phase 1. Same divergence-from-spec-template rationale as
 * `GENERATE_CAPTION_SYSTEM_PROMPT` above — static persona/task/format, variable brand/location/
 * product data sent as the user message's JSON body instead of interpolated into the prompt string.
 */
const GENERATE_HASHTAGS_SYSTEM_PROMPT = `Kamu adalah Tamara, Social Media Manager untuk tenant AAOS.

Tugas: generate 8-12 hashtag relevan untuk satu posting organik, dari brief (JSON di pesan user):
- productName: nama produk/unit/listing
- brand: nama brand/tenant untuk brand hashtag
- location: cabang/lokasi untuk location hashtag
- vertical: AUTOMOTIVE (dealer mobil bekas) atau PROPERTY (agen properti)

PANDUAN:
- Campur: brand hashtag + product hashtag + location hashtag + generic hashtag sesuai vertical
- Setiap hashtag diawali "#", tanpa spasi di dalamnya
- Bahasa Indonesia, relevan untuk audiens Indonesia
- Tepat 8 sampai 12 hashtag, tidak lebih tidak kurang

Format response JSON:
{
  "hashtags": ["#Contoh1", "#Contoh2", "..."]
}`;

/**
 * OpenAI-backed implementation of Tamara's `analyze`/`creativeBrief`/`chat` capabilities
 * (`src/modules/llm/llm.controller.ts`'s three endpoints), plus `selectTargeting`
 * (AAOS-SIMULASI-TARGETING) which is deliberately IN-PROCESS ONLY — it is called by
 * `SimulationService`'s TAMARA stage and has no HTTP endpoint of its own, because its input
 * (the real candidate interest set) must be assembled server-side from `meta_interests`, never
 * accepted from a client. Also `generateCaption`/`generateHashtags` (AAOS-SOSMED-AUTOMATION
 * Phase 1) — called by `modules/sosmed`'s `SosmedController` at `POST /api/v1/sosmed/
 * generate-caption`/`generate-hashtags`, per coordinator note #3's "add a new method to
 * `LlmService` … rather than inventing a different LLM-calling convention". Every method follows
 * the same shape:
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

  /**
   * AAOS-SIMULASI-TARGETING: Tamara picks a relevant subset of REAL Meta interests from the real
   * candidates the caller queried out of `meta_interests`. Same cache/gate/validate shape as
   * `analyze`/`creativeBrief` above, plus one extra, load-bearing step:
   *
   * **The response is intersected against the real candidate id set server-side.** Any id the model
   * returns that it was not shown is dropped into `rejectedIds` and never reaches the caller — an
   * LLM is not trusted to only pick from what it was given, no matter what the prompt says. If
   * NOTHING survives the intersection, the whole response is treated as `INVALID_RESPONSE` rather
   * than returning an empty, meaningless "selection".
   */
  async selectTargeting(body: SelectTargetingRequestDto): Promise<SelectTargetingResponseDto> {
    const cached = this.cache.get("select-targeting", body) as
      SelectTargetingResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: SELECT_TARGETING_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(body) },
      ],
      jsonMode: true,
    });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const parsed = safeJsonParse(completion.value);
    const validated =
      parsed === undefined ? undefined : SelectTargetingLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      return unavailable("INVALID_RESPONSE");
    }

    const candidateIds = new Set(body.candidates.map((candidate) => candidate.id));
    const interestIds = validated.data.interestIds.filter((id) => candidateIds.has(id));
    const rejectedIds = validated.data.interestIds.filter((id) => !candidateIds.has(id));
    if (interestIds.length === 0) {
      return unavailable("INVALID_RESPONSE");
    }

    const response: SelectTargetingResponseDto = {
      available: true,
      interestIds,
      reasoning: validated.data.reasoning,
      rejectedIds,
    };
    this.cache.set("select-targeting", body, response);
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

  /**
   * AAOS-SOSMED-AUTOMATION Phase 1 — `POST /api/v1/sosmed/generate-caption`. Same cache/gate/
   * call/validate/cache shape as `analyze`/`creativeBrief`/`selectTargeting` above.
   */
  async generateCaption(body: GenerateCaptionRequestDto): Promise<GenerateCaptionResponseDto> {
    const cached = this.cache.get("generate-caption", body) as
      GenerateCaptionResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: GENERATE_CAPTION_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(body) },
      ],
      jsonMode: true,
    });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const parsed = safeJsonParse(completion.value);
    const validated =
      parsed === undefined ? undefined : GenerateCaptionLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      return unavailable("INVALID_RESPONSE");
    }

    const response: GenerateCaptionResponseDto = { available: true, ...validated.data };
    this.cache.set("generate-caption", body, response);
    return response;
  }

  /**
   * AAOS-SOSMED-AUTOMATION Phase 1 — `POST /api/v1/sosmed/generate-hashtags`. Same cache/gate/
   * call/validate/cache shape as every other method on this service.
   */
  async generateHashtags(body: GenerateHashtagsRequestDto): Promise<GenerateHashtagsResponseDto> {
    const cached = this.cache.get("generate-hashtags", body) as
      GenerateHashtagsResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: GENERATE_HASHTAGS_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(body) },
      ],
      jsonMode: true,
    });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const parsed = safeJsonParse(completion.value);
    const validated =
      parsed === undefined ? undefined : GenerateHashtagsLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      return unavailable("INVALID_RESPONSE");
    }

    const response: GenerateHashtagsResponseDto = { available: true, ...validated.data };
    this.cache.set("generate-hashtags", body, response);
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
