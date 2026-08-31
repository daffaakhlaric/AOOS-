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
import {
  CampaignStrategyLlmPayloadSchema,
  type CampaignStrategyRequestDto,
  type CampaignStrategyResponseDto,
} from "./dto/campaign-strategy.dto.js";
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
  ResolveLocationLlmPayloadSchema,
  type ResolveLocationRequestDto,
  type ResolveLocationResponseDto,
} from "./dto/resolve-location.dto.js";
import {
  SelectTargetingLlmPayloadSchema,
  type SelectTargetingRequestDto,
  type SelectTargetingResponseDto,
} from "./dto/select-targeting.dto.js";
import type { OpenAiChatMessage, OpenAiClient } from "./infrastructure/OpenAiClient.js";

/** Verbatim system prompt from the spec's `POST /api/v1/llm/analyze` section. */
const ANALYZE_SYSTEM_PROMPT = `Kamu adalah Samantha, AI Marketing Manager untuk DSS Motor (Mobix)
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
const CREATIVE_BRIEF_SYSTEM_PROMPT = `Kamu adalah Samantha, AI Marketing Manager untuk DSS Motor (Mobix).
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
 * Written in the same "Kamu adalah Samantha…" persona as the two prompts above, and worded to make
 * the candidate constraint explicit in the prompt itself (belt) on top of the server-side
 * candidate-set intersection in `selectTargeting` (braces — the prompt is a request, the
 * intersection is the guarantee).
 */
const SELECT_TARGETING_SYSTEM_PROMPT = `Kamu adalah Samantha, AI Marketing Manager untuk DSS Motor (Mobix) — dealer mobil bekas di Indonesia.

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

/**
 * AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 4 — `LlmService.campaignStrategy`, the ONE genuinely
 * LLM-dependent step of that effort (coordinator note point 4). Adapted from the spec's
 * `SAMANTHA_CAMPAIGN_DECISION_PROMPT`, corrected onto real angle vocabulary: the AUTOMOTIVE product
 * angles are the real 7-member `AdAngle` enum, the PROPERTY product angles are the real 8-member
 * `PropertyAdAngle` string values, and the brand angles are `@aos/meta-ads-agent`'s new real
 * `BRAND_ANGLES` constant — never the spec's fictional `STOK_TERBATAS`/`PRICE_FOCUS`/
 * `BRAND_AWARENESS`/etc. The request body (`CampaignStrategyRequestDto`) explicitly carries the
 * real, request-specific `brandAngleIds`/`productAngleValues` for whichever vertical this call is
 * for, so the prompt's own "pilih HANYA dari daftar berikut" instruction always matches what
 * `LlmService.campaignStrategy` will actually accept post-parse (see that method's angle
 * membership check — belt-and-braces, same as `selectTargeting`'s candidate-id intersection).
 */
const CAMPAIGN_STRATEGY_SYSTEM_PROMPT = `Kamu adalah Samantha, AI Campaign Manager untuk dealer mobil bekas (AUTOMOTIVE) atau platform properti (PROPERTY) di Indonesia — vertical yang sedang ditangani ada di field "vertical" pada data JSON yang diberikan.

TUGASMU: berdasarkan semua real signal yang diberikan (seasonal, Google Trends, kompetitor, stok/listing, profil hot lead, riwayat closing), tentukan strategi campaign terbaik.

ATURAN KERAS SOAL ANGLE:
- "brandCampaign.angle" HANYA boleh salah satu dari daftar "brandAngleIds" pada data JSON. Dilarang mengarang id baru.
- "productCampaign.angle" HANYA boleh salah satu dari daftar "productAngleValues" pada data JSON. Dilarang mengarang angle baru.

OUTPUT FORMAT (JSON):
{
  "campaignMode": "BRAND" | "PRODUCT" | "BOTH",
  "reasoning": "kenapa memilih mode ini",

  "brandCampaign": {
    "angle": "salah satu dari brandAngleIds",
    "copy": "teks iklan yang disarankan",
    "objective": "OUTCOME_AWARENESS" | "OUTCOME_LEADS" | "OUTCOME_ENGAGEMENT",
    "budgetPct": 30,
    "reasoning": "kenapa angle ini"
  },

  "productCampaign": {
    "angle": "salah satu dari productAngleValues",
    "targetUnit": "nama unit atau listing",
    "copy": "teks iklan",
    "objective": "OUTCOME_LEADS",
    "budgetPct": 70,
    "reasoning": "kenapa unit/angle ini"
  },

  "budgetRecommendation": { "action": "SCALE" | "REDUCE" | "MAINTAIN", "multiplier": 1.0, "reasoning": "kenapa" },

  "targeting": { "locations": ["area1"], "ageMin": 22, "ageMax": 55, "interests": ["interest1"], "reasoning": "based on hot lead profile" },

  "timing": { "bestHours": [10, 13, 19], "reasoning": "peak engagement dari lead data" },

  "urgency": "HIGH" | "MEDIUM" | "LOW",
  "summary": "1 kalimat ringkasan strategi"
}

"brandCampaign" WAJIB diisi jika campaignMode BRAND atau BOTH. "productCampaign" WAJIB diisi jika campaignMode PRODUCT atau BOTH.

PANDUAN KEPUTUSAN:
- Jika stok/listing menipis atau ada unit baru → PRODUCT dengan angle yang relevan dari productAngleValues.
- Jika seasonal event aktif → scale budget, pertimbangkan angle event tersebut.
- Jika kompetitor sudah saturasi satu angle → hindari angle itu, cari angle lain dari productAngleValues yang belum jenuh.
- Jika Google Trends menunjukkan tren naik tapi belum ada campaign untuk itu → pertimbangkan launch segera.
- Jika tidak ada unit/listing spesifik yang mendesak → BRAND campaign lebih aman.
- Mix BRAND + PRODUCT umum: 30% brand (awareness) + 70% product (leads), boleh disesuaikan alasan konkret.
- Jangan selalu fokus produk — brand awareness penting untuk jangka panjang.`;

/**
 * AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase C point 1 — `LocationResolverService`'s only prompt.
 * PROPERTY-only (AUTOMOTIVE keeps using the existing `Branch`-based `AreaPriority`, unchanged).
 * Same static-persona-plus-JSON-user-message shape as every other prompt in this file — the real,
 * per-listing variable data (title/type/price/city/province/address/branch) is sent as the user
 * message's `JSON.stringify(body)`, never interpolated into this string.
 */
const RESOLVE_LOCATION_SYSTEM_PROMPT = `Kamu adalah Samantha, AI Marketing Manager untuk platform properti (PROPERTY) di Indonesia.

Tugasmu: berdasarkan data satu listing properti (JSON di pesan user — judul, tipe properti, harga, kota/provinsi/alamat jika ada, nama cabang jika ada), tentukan target lokasi iklan Meta Ads yang paling relevan: kota-kota tujuan dan radius (km) di sekitarnya, plus estimasi rentang usia pembeli yang relevan (untuk preview saja).

ATURAN KERAS:
- "cities" HANYA nama kota/kabupaten Indonesia yang nyata dan relevan dengan lokasi listing (maksimal 6).
- Jika listing punya kota/provinsi eksplisit, jadikan itu prioritas utama, radius menyesuaikan seberapa jauh pembeli realistis mau mencari properti sejenis (properti murah/kecil → radius lebih sempit, properti mahal/besar → boleh lebih luas antar kota Jabodetabek dsb).
- "reasoning" ditulis dalam Bahasa Indonesia, satu atau dua kalimat.

Format response JSON:
{
  "cities": ["kota1", "kota2"],
  "radiusKm": 25,
  "ageMin": 27,
  "ageMax": 55,
  "reasoning": "alasan singkat dalam Bahasa Indonesia"
}`;

/** Not a literal spec quote (the spec's `/llm/chat` section has no system-prompt block of its own) — derived from the same "Kamu adalah Samantha..." persona used by the other two prompts, for general free-text conversation. */
const CHAT_SYSTEM_PROMPT =
  "Kamu adalah Samantha, AI Marketing Manager untuk DSS Motor (Mobix) — dealer mobil bekas di Indonesia. Jawab pertanyaan dengan jelas, actionable, dan dalam Bahasa Indonesia.";

/**
 * AAOS-SOSMED-AUTOMATION Phase 1. NOT a verbatim copy of the spec's `CAPTION_SYSTEM_PROMPT`
 * template literal — that template interpolates `tenant.name`/`vertical`/`productData` directly
 * into the system prompt string, which is a different LLM-calling convention than every other
 * method on this service uses. Every real method here (`analyze`/`creativeBrief`/`selectTargeting`)
 * instead keeps the system prompt STATIC (persona + task + output format only) and sends the
 * per-request variable data as `JSON.stringify(body)` in the user message — so this prompt follows
 * that same real, established shape rather than inventing a second one.
 */
const GENERATE_CAPTION_SYSTEM_PROMPT = `Kamu adalah Samantha, Social Media Manager untuk tenant AAOS.

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
const GENERATE_HASHTAGS_SYSTEM_PROMPT = `Kamu adalah Samantha, Social Media Manager untuk tenant AAOS.

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
 * OpenAI-backed implementation of Samantha's `analyze`/`creativeBrief`/`chat` capabilities
 * (`src/modules/llm/llm.controller.ts`'s three endpoints), plus `selectTargeting`
 * (AAOS-SIMULASI-TARGETING) which is deliberately IN-PROCESS ONLY — it is called by
 * `SimulationService`'s SAMANTHA stage and has no HTTP endpoint of its own, because its input
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
   * AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 4 — the campaign-strategy decision-synthesis step
   * (coordinator note point 4). Same cache/gate/call/validate/cache shape as every other method on
   * this service, plus one extra, load-bearing step mirroring `selectTargeting`'s candidate-set
   * intersection: `brandCampaign.angle`/`productCampaign.angle` are checked against the REAL
   * `brandAngleIds`/`productAngleValues` the request itself supplied (the caller,
   * `IntelligenceService`, builds those from `@aos/meta-ads-agent`'s real `BRAND_ANGLES`/`AdAngle`/
   * `PropertyAdAngle`) — an LLM is not trusted to only pick from the vocabulary the prompt asked
   * for, no matter what the prompt says. Any angle outside those real sets fails the whole response
   * as `INVALID_RESPONSE`, same as a schema-validation failure.
   */
  async campaignStrategy(body: CampaignStrategyRequestDto): Promise<CampaignStrategyResponseDto> {
    const cached = this.cache.get("campaign-strategy", body) as
      CampaignStrategyResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: CAMPAIGN_STRATEGY_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(body) },
      ],
      jsonMode: true,
    });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const parsed = safeJsonParse(completion.value);
    const validated =
      parsed === undefined ? undefined : CampaignStrategyLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      return unavailable("INVALID_RESPONSE");
    }

    const brandAngleIds = new Set(body.brandAngleIds);
    const productAngleValues = new Set(body.productAngleValues);
    const brandAngleOk =
      validated.data.brandCampaign === undefined ||
      brandAngleIds.has(validated.data.brandCampaign.angle);
    const productAngleOk =
      validated.data.productCampaign === undefined ||
      productAngleValues.has(validated.data.productCampaign.angle);
    if (!brandAngleOk || !productAngleOk) {
      return unavailable("INVALID_RESPONSE");
    }

    const response: CampaignStrategyResponseDto = { available: true, ...validated.data };
    this.cache.set("campaign-strategy", body, response);
    return response;
  }

  /**
   * AAOS-SIMULASI-TARGETING: Samantha picks a relevant subset of REAL Meta interests from the real
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

  /**
   * AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase C point 1 — `LocationResolverService`'s only call
   * into `LlmService`. Same cache/gate/call/validate/cache shape as every other method on this
   * service — no freestanding OpenAI client, no bespoke composition. The real deterministic
   * fallback (`propertyBranchAudienceDefault` from `@aos/meta-ads-connector`) lives in
   * `LocationResolverService`, not here — this method only ever returns the LLM outcome (available
   * or a typed `LlmUnavailableResponseDto`), same as `analyze`/`creativeBrief`/`selectTargeting`.
   */
  async resolveLocation(body: ResolveLocationRequestDto): Promise<ResolveLocationResponseDto> {
    const cached = this.cache.get("resolve-location", body) as
      ResolveLocationResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: RESOLVE_LOCATION_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(body) },
      ],
      jsonMode: true,
    });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const parsed = safeJsonParse(completion.value);
    const validated =
      parsed === undefined ? undefined : ResolveLocationLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      return unavailable("INVALID_RESPONSE");
    }

    const response: ResolveLocationResponseDto = { available: true, ...validated.data };
    this.cache.set("resolve-location", body, response);
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
