import { createLogger } from "@aos/logger";
import type { IRateLimiter } from "@aos/meta-ads-connector";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import {
  AAOS_API_CONFIG,
  LLM_OPENAI_CLIENT,
  LLM_RATE_LIMITER,
  LLM_RESPONSE_CACHE,
} from "../../di-tokens.js";
import { PromptOverrideService } from "../prompt-override/prompt-override.service.js";

import type { ResponseCache } from "./cache/ResponseCache.js";
import {
  AdCopyVariantsLlmPayloadSchema,
  type AdCopyVariantsRequestDto,
  type AdCopyVariantsResponseDto,
} from "./dto/ad-copy-variants.dto.js";
import {
  AnalyzeLlmPayloadSchema,
  type AnalyzeRequestDto,
  type AnalyzeResponseDto,
} from "./dto/analyze.dto.js";
import {
  AssetInsightLlmPayloadSchema,
  type AssetInsightRequestDto,
  type AssetInsightResponseDto,
} from "./dto/asset-insight.dto.js";
import {
  CampaignInsightLlmPayloadSchema,
  type CampaignInsightRequestDto,
  type CampaignInsightResponseDto,
} from "./dto/campaign-insight.dto.js";
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
  DailyInsightLlmPayloadSchema,
  type DailyInsightRequestDto,
  type DailyInsightResponseDto,
} from "./dto/daily-insight.dto.js";
import {
  DiagnoseAdCopyLlmPayloadSchema,
  type DiagnoseAdCopyRequestDto,
  type DiagnoseAdCopyResponseDto,
} from "./dto/diagnose-ad-copy.dto.js";
import {
  DiverseCreativeBriefSetLlmPayloadSchema,
  type DiverseCreativeBriefSetRequestDto,
  type DiverseCreativeBriefSetResponseDto,
} from "./dto/diverse-creative-brief-set.dto.js";
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
import {
  ImprovementPlanLlmPayloadSchema,
  type ImprovementItem,
  type ImprovementPlanRequestDto,
  type ImprovementPlanResponseDto,
} from "./dto/improvement-plan.dto.js";
import {
  ClaraJudgeLlmPayloadSchema,
  KaiJudgeLlmPayloadSchema,
  SamanthaJudgeLlmPayloadSchema,
  type JudgeAgentRunRequestDto,
  type JudgeAgentRunResponseDto,
} from "./dto/judge-agent-run.dto.js";
import { unavailable, type LlmUnavailableResponseDto } from "./dto/llm-unavailable.dto.js";
import {
  PhotoAnalysisLlmPayloadSchema,
  type PhotoAnalysisRequestDto,
  type PhotoAnalysisResponseDto,
} from "./dto/photo-analysis.dto.js";
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
import {
  SelfAnalysisLlmPayloadSchema,
  type SelfAnalysisRequestDto,
  type SelfAnalysisResponseDto,
} from "./dto/self-analysis.dto.js";
import type { OpenAiChatMessage, OpenAiClient } from "./infrastructure/OpenAiClient.js";

/** Every `LlmService` method resolves its system prompt against this agent — SAMANTHA is the only
 * real LLM-chat-prompt agent this service backs (Clara's equivalent resolution lives in
 * `packages/sales-agent`'s `buildSystemPrompt`, a different, non-Nest package — see that file). */
const SAMANTHA_AGENT = "SAMANTHA";

/**
 * AAOS Self-Learning AI, Phase A's real `agent_prompt_overrides.prompt_key` vocabulary
 * (`022_agent_prompt_overrides.sql`'s own doc comment — verified directly against that migration
 * file, not trusted from memory) plus `"generate_improvement_plan"`, this phase's own new prompt
 * key (added the same free-TEXT, no-migration-needed way `022`'s header doc says a future prompt
 * key can be). `LlmService.generateImprovementPlan`'s Zod-validated output is checked against this
 * SAME list server-side (belt-and-braces, same discipline `selectTargeting`'s candidate-id
 * intersection / `campaignStrategy`'s angle-membership check already establish for "don't trust the
 * LLM to only use the vocabulary it was given") — also exported for `LearningService` to reuse
 * rather than re-declaring a second, possibly-drifting copy of this list.
 */
export const KNOWN_PROMPT_KEYS: readonly string[] = [
  "analyze",
  "creative_brief",
  "campaign_strategy",
  "select_targeting",
  "resolve_location",
  "asset_insight",
  "chat",
  "generate_caption",
  "generate_hashtags",
  "clara_system_prompt",
  // AAOS Self-Learning AI — PROPERTY LLM wiring: `packages/sales-agent`'s real PROPERTY-vertical
  // sibling to `clara_system_prompt` (`buildClaraPropertyPrompt.ts`'s `buildPropertySystemPrompt`),
  // resolved by `apps/aaos-simulator`'s vertical-aware `fetchActiveClaraPromptOverride` for
  // `vertical === "PROPERTY"`.
  "clara_property_system_prompt",
  "generate_improvement_plan",
  // AAOS Overview Monitor Phase O1 — `LlmService.generateDailyInsight`'s prompt key.
  "generate_daily_insight",
  // AAOS Self-Improving, Phase SI-3 — `LlmService.selfAnalyze`'s prompt key.
  "self_analyze_gap",
  // AAOS-CAMPAIGNS-UNIFIED-PAGE — `LlmService.campaignInsight`'s prompt key (the unified
  // `/campaigns` page's per-campaign `CampaignInsightPanel` narrative + action list).
  "campaign_insight",
  // AAOS-SAMANTHA-LLM-AD-COPY — `LlmService.generateAdCopyVariants`'s prompt key.
  "generate_ad_copy_variants",
  // AAOS Samantha Professional Optimizer, Part C — `LlmService.diagnoseAdCopy`'s prompt key.
  "diagnose_ad_copy",
  // Samantha Andromeda-Aware Campaign System, Sprint 2 —
  // `LlmService.generateDiverseCreativeBriefSet`'s prompt key.
  "generate_diverse_creative_brief_set",
];

/**
 * AAOS Self-Improving, Phase SI-1's real, additive sibling of `KNOWN_PROMPT_KEYS` — the real
 * `agent_configs.config_key` vocabulary this phase wires up (`034_agent_configs.sql`'s own header
 * doc), so a `CONFIG_UPDATE` improvement item targeting one of these 2 real keys is no longer
 * silently dropped by `generateImprovementPlan`'s own known-key check below (see that method's own
 * doc — this REPLACES the previous "every CONFIG_UPDATE is dropped, no real config_key vocabulary
 * exists yet" finding for exactly these 2 keys; every other `CONFIG_UPDATE` target still gets
 * dropped, same discipline as an unknown `PROMPT_UPDATE` target).
 */
export const KNOWN_CONFIG_KEYS: readonly string[] = [
  "pause_cpl_multiplier",
  "live_run_gap_threshold",
];

/**
 * AAOS Self-Improving, Phase SI-2's real, additive sibling of `KNOWN_CONFIG_KEYS` — the real
 * `agent_logic.logic_key` vocabulary this phase wires up (`035_agent_logic.sql`'s own header doc),
 * so a `LOGIC_UPDATE` improvement item targeting this one real key is no longer silently dropped by
 * `generateImprovementPlan`'s own known-key check below. `LOGIC_UPDATE` is a NEW real improvement
 * `type` as of this phase (it did not exist in `ImprovementItemSchema.type` before — see that
 * schema's own doc); `"verdict_classification"` is the one real, safe, DISPLAY-only decision point
 * this phase wires an optional rule-based override into (`SchedulerService.runSamanthaAnalyze`'s
 * real PAUSE/SCALE digest classification — see that method's own doc for the full "why this one,
 * why it's safe" reasoning).
 */
export const KNOWN_LOGIC_KEYS: readonly string[] = ["verdict_classification"];

/**
 * Verbatim system prompt from the spec's `POST /api/v1/llm/analyze` section. Exported (AAOS
 * Self-Learning AI, Phase B) so `LearningService` can pass the SAME real fallback constant into
 * `PromptOverrideService.resolve(tenantId, "SAMANTHA", "analyze", ANALYZE_SYSTEM_PROMPT)` when
 * building a SAMANTHA improvement proposal's "current active prompt" context — reusing the exact
 * constant this file's own `analyze()` method falls back to, not a second, possibly-drifting copy.
 */
export const ANALYZE_SYSTEM_PROMPT = `Kamu adalah Samantha, AI Marketing Manager untuk DSS Motor (Mobix)
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

TUGASMU: berdasarkan semua real signal yang diberikan (seasonal, Google Trends, kompetitor, stok/listing, profil hot lead, riwayat closing, dan "marketSignals" jika ada), tentukan strategi campaign terbaik.

JIKA field "marketSignals" ADA di data JSON (bisa tidak ada jika belum pernah di-refresh untuk tenant ini):
- "marketSignals.searchTrend" (jika available: true) — daftar keyword pencarian dengan delta % minggu ini. Keyword yang naik signifikan (delta positif besar) adalah sinyal minat pasar yang sedang menguat — pertimbangkan untuk merujuknya di reasoning.
- "marketSignals.competitorAngleTrend" (jika available: true) — angle yang paling sering dipakai kompetitor saat ini (angleCounts/topAngle). Hindari mengulang angle yang sudah jenuh dipakai kompetitor kalau ada alternatif yang belum jenuh.
- "marketSignals.kprRate" (jika available: true) — rate KPR/BI saat ini dan arahnya (naik/turun/stabil). Rate turun biasanya mendukung angle DP_RINGAN/cicilan; rate naik biasanya butuh angle yang menonjolkan value/investasi.
- "marketSignals.seasonality" — status "musim ramai" atau "musim sepi" plus catatannya (THR/tahun ajaran baru/akhir tahun). Musim ramai → pertimbangkan scale budget dan angle yang disebutkan di catatannya.
- HANYA gunakan sinyal yang benar-benar "available: true" (atau seasonality, yang selalu ada). JANGAN mengarang angka/keyword/angle yang tidak ada di "marketSignals". Kalau sebuah sub-field "available: false", JANGAN dirujuk di reasoning sama sekali.
- "marketSignals" MELENGKAPI data performa Meta Ads di atas, bukan menggantikannya — tetap prioritaskan data performa nyata (spend/CTR/lead) untuk keputusan inti.

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

/**
 * AAOS Analytics Platform Phase 4, "Creative Drill-Down" — the one real LLM-generated insight
 * this phase adds (contrast Phase 3's deliberately deterministic `generateHeatmapInsight`, which
 * stays a pure template per that phase's own explicit instruction). Same static persona +
 * JSON-user-message shape every other real prompt in this file uses — the per-asset variable data
 * (`AssetInsightRequestDto`, built server-side by `MetaAdsService.getAssetDetail` from its own
 * already-computed real spend/CPL/audience-breakdown numbers) is sent as the user message.
 */
const ASSET_INSIGHT_SYSTEM_PROMPT = `Kamu diberi data performa SATU aset kreatif (gambar/video) yang dipakai di beberapa iklan, dipecah per label audiens (BROAD/INTEREST/LOOKALIKE_1/RETARGETING/CUSTOM_CRM) — semua angka nyata dari Meta Ads. Kamu akan menjawab sebagai DUA persona sekaligus, dari data yang SAMA — jangan mengarang angka yang tidak ada di data untuk persona manapun.

PERSONA 1 — KAI, Creative Strategist AI:
Tulis SATU paragraf singkat (2-3 kalimat) dalam Bahasa Indonesia dari sudut pandang strategi kreatif: audiens/kombinasi mana yang paling menjanjikan untuk digarap lagi dengan kreatif baru (angle/hook apa yang kemungkinan cocok), berdasarkan pola CPL/lead nyata per audiens. Ini adalah rekomendasi ARAH KREATIF ke depan, bukan angka performa.

PERSONA 2 — SAMANTHA, AI Marketing Manager (media buyer):
Tulis SATU paragraf singkat (2-3 kalimat) dalam Bahasa Indonesia berupa VERDICT media-buying: audiens mana yang paling efisien untuk aset ini saat ini (CPL terendah dengan lead nyata), apakah performanya di atas/di bawah rata-rata CPL portofolio (jika data itu tersedia), dan rekomendasi scale/hold/kill untuk kombinasi aset+audiens ini.

Format response JSON:
{
  "kaiTake": "satu paragraf dari Kai dalam Bahasa Indonesia",
  "samanthaVerdict": "satu paragraf dari Samantha dalam Bahasa Indonesia"
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
 * AAOS Self-Learning AI, Phase B — `LlmService.generateImprovementPlan`'s system prompt. The real
 * per-request variable data (gap scores/verdict/judge `feedbackItems`, the current active prompt
 * content, and the tenant's last 3 real `learning_proposals`) is sent as the user message's
 * `JSON.stringify(body)`, same static-persona-plus-JSON-user-message shape every other prompt in
 * this file uses. No `expectedImpact` numeric field is requested — see
 * `dto/improvement-plan.dto.ts`'s doc for why a fabricated precise-sounding number is deliberately
 * avoided in favor of a qualitative `severity`.
 */
const IMPROVEMENT_PLAN_SYSTEM_PROMPT = `Kamu adalah Samantha, AI Marketing Manager untuk tenant AAOS. Kamu sedang mereview hasil SIMULASI atau RUN LIVE (agent sungguhan) yang skornya di bawah standar, dan bertugas mengusulkan perbaikan prompt AI.

Kamu diberi (semua data JSON di pesan user):
- "gap": data gap nyata, field "source" menentukan bentuknya —
  - "source": "SIMULATION" → skor simulasi nyata (samanthaCoverageScore, kaiScore, claraScore, overallScore, grade, verdict) dan catatan asli dari AI Judge simulasi (feedbackItems, tiap item punya "dimension" dan "message").
  - "source": "LIVE_RUN" → hasil AI Judge nyata dari SATU run agent sungguhan (agent, overallScore, scores per-dimensi, trend) dan catatan gap nyata (feedbackItems, tiap item punya "dimension" dan "message"). JANGAN sebut ini "simulasi" dalam analisamu — ini run sungguhan dari agent yang sedang berjalan.
- "currentPromptKey"/"currentPromptContent": prompt AKTIF tenant ini sekarang untuk agent yang relevan.
- "recentProposals": maksimal 3 proposal improvement terakhir untuk tenant ini (agar kamu tidak mengusulkan hal yang sama persis lagi).

TUGASMU: analisa KENAPA skor/verdict ini terjadi (rujuk feedbackItems nyata, jangan mengarang alasan), lalu usulkan 1-3 perbaikan konkret.

ATURAN KERAS:
- "improvements[].target" HANYA boleh salah satu prompt_key nyata berikut: analyze, creative_brief, campaign_strategy, select_targeting, resolve_location, asset_insight, chat, generate_caption, generate_hashtags, clara_system_prompt. Dilarang mengarang key baru.
- "improvements[].before" HARUS kutipan nyata (atau ringkasan jujur) dari "currentPromptContent" yang diberikan — jangan mengarang isi prompt yang tidak ada.
- "improvements[].after" adalah usulan teks prompt baru yang konkret, bukan saran abstrak.
- JANGAN sertakan skor dampak numerik yang dikarang (misalnya "akan menaikkan skor 15 poin") — gunakan "severity" (LOW/MEDIUM/HIGH) saja sebagai sinyal kualitatif.
- "reason" ditulis dalam Bahasa Indonesia, merujuk data gap yang nyata.

Format response JSON:
{
  "analysis": "analisa singkat dalam Bahasa Indonesia kenapa gap ini terjadi, merujuk feedbackItems/skor nyata",
  "improvements": [
    {
      "agent": "SAMANTHA" | "CLARA",
      "type": "PROMPT_UPDATE" | "CONFIG_UPDATE" | "LOGIC_UPDATE",
      "target": "salah satu prompt_key di atas",
      "before": "kutipan/ringkasan jujur dari prompt aktif",
      "after": "usulan teks prompt baru",
      "reason": "alasan singkat dalam Bahasa Indonesia",
      "severity": "LOW" | "MEDIUM" | "HIGH"
    }
  ]
}`;

/**
 * AAOS Self-Improving, Phase SI-3 — `LlmService.selfAnalyze`'s system prompt. A real, SEPARATE LLM
 * call from `generateImprovementPlan`, asking "why" (root causes) BEFORE that call asks "what to
 * change". Fed the SAME real per-request data `generateImprovementPlan` receives (gap scores/
 * verdict/judge `feedbackItems`, the current active prompt content, and the tenant's last 3 real
 * `learning_proposals`) as the user message's `JSON.stringify(body)` — see
 * `dto/self-analysis.dto.ts`'s own doc for why no separate, parallel data-fetching path exists.
 * `LearningService` calls this method FIRST (best-effort — see `LearningService`'s own doc for why
 * a `selfAnalyze` failure never blocks proposal generation), then feeds its real output back into
 * the SAME gap's `generateImprovementPlan` call as `body.selfAnalysis`.
 */
const SELF_ANALYZE_SYSTEM_PROMPT = `Kamu adalah Samantha, AI Marketing Manager untuk tenant AAOS. Kamu sedang melakukan ANALISA AKAR MASALAH (root cause analysis) atas hasil SIMULASI atau RUN LIVE (agent sungguhan) yang skornya di bawah standar — SEBELUM tim lain mengusulkan perbaikan konkret. Tugasmu HANYA menjawab KENAPA, bukan mengusulkan perbaikan.

Kamu diberi (semua data JSON di pesan user):
- "gap": data gap nyata, field "source" menentukan bentuknya —
  - "source": "SIMULATION" → skor simulasi nyata (samanthaCoverageScore, kaiScore, claraScore, overallScore, grade, verdict) dan catatan asli dari AI Judge simulasi (feedbackItems, tiap item punya "dimension" dan "message").
  - "source": "LIVE_RUN" → hasil AI Judge nyata dari SATU run agent sungguhan (agent, overallScore, scores per-dimensi, trend) dan catatan gap nyata (feedbackItems, tiap item punya "dimension" dan "message"). JANGAN sebut ini "simulasi" dalam analisamu — ini run sungguhan dari agent yang sedang berjalan.
- "currentPromptKey"/"currentPromptContent": prompt AKTIF tenant ini sekarang untuk agent yang relevan.
- "recentProposals": maksimal 3 proposal improvement terakhir untuk tenant ini (agar kamu bisa melihat pola/tren nyata dari riwayat, bukan cuma satu titik data).

TUGASMU: identifikasi 1-5 kemungkinan AKAR MASALAH nyata (rootCauses) yang menjelaskan KENAPA skor/verdict ini terjadi — rujuk feedbackItems nyata, jangan mengarang alasan. Lalu tulis SATU pengamatan (patterns) tentang pola/tren nyata dari "recentProposals" (mis. apakah masalah yang sama berulang, apakah proposal sebelumnya sudah pernah menyentuh isu ini). Terakhir, beri "confidence" (0.0-1.0) yang JUJUR seberapa yakin kamu terhadap analisa akar masalah ini berdasarkan data yang benar-benar tersedia — confidence rendah jika data/feedbackItems sedikit, confidence tinggi hanya jika polanya jelas dan berulang.

ATURAN KERAS:
- JANGAN mengusulkan perbaikan prompt/config/logic di sini — itu bukan tugasmu di langkah ini (langkah berikutnya yang akan melakukannya, dengan hasil analisamu sebagai konteks tambahan).
- "rootCauses" ditulis dalam Bahasa Indonesia, tiap item singkat dan konkret, merujuk data gap yang nyata.
- "patterns" ditulis dalam Bahasa Indonesia, satu atau dua kalimat. Jika "recentProposals" kosong, katakan jujur bahwa ini proposal pertama untuk tenant ini, tanpa mengarang pola yang tidak ada.
- "confidence" adalah angka nyata 0.0-1.0, JANGAN selalu 1.0 — sinyal kejujuran seberapa kuat data mendukung analisamu.

Format response JSON:
{
  "rootCauses": ["akar masalah 1 dalam Bahasa Indonesia", "akar masalah 2"],
  "patterns": "satu atau dua kalimat pengamatan pola/tren dalam Bahasa Indonesia",
  "confidence": 0.7
}`;

/**
 * AAOS Overview Monitor Phase O1, Finding 4 item 2 — `LlmService.generateDailyInsight`'s system
 * prompt. Adapted from the pasted EYVRA spec's own "BAGIAN 2: INSIGHT BAR" `insightPrompt`
 * template (`docs/PROMPT-EYVRA-OVERVIEW-MONITOR-PAGE.md`), CORRECTED per
 * `docs/PROMPT-AAOS-OVERVIEW-MONITOR.md` Finding 1: only SAMANTHA/KAI/CLARA are real agents in
 * this codebase — the spec's own `"Samantha: ... Clara: ... Kai: ..."` example line and its
 * `perAgent.karen` field are both dropped; there is no real "Karen" data to summarize, and
 * fabricating a 4th sentence would be exactly the kind of dishonest placeholder this whole effort's
 * discipline avoids elsewhere. The real per-agent/campaign/lead/recycling data sent as the user
 * message (`JSON.stringify(body)`, same static-persona-plus-JSON-user-message shape every other
 * prompt in this file uses) is `DailyInsightRequestDto` — every field on it is a REAL number this
 * codebase can already honestly compute (see that DTO's own doc for exactly which real source each
 * field comes from); a `null` field (e.g. `campaigns: null` when the real Meta pull failed this
 * request) is a real, honest "unavailable" signal, not an invented zero.
 */
const DAILY_INSIGHT_SYSTEM_PROMPT = `Kamu adalah Samantha, AI Marketing Manager untuk tenant AAOS. Kamu menulis ringkasan harian singkat untuk pemilik bisnis, dibaca sekali sambil lihat dashboard pagi hari.

Kamu diberi data hari ini (JSON di pesan user):
- "agents": array 3 agent nyata — SAMANTHA (Meta Ads Manager), KAI (Creative AI), CLARA (Sales AI). Masing-masing punya "todayAverageOverall" (skor AI Judge rata-rata hari ini, bisa null jika belum ada run yang dinilai hari ini), "delta" (vs rata-rata 7 hari sebelumnya, bisa null), "actionsToday" (jumlah aksi nyata hari ini).
- "campaigns": ringkasan campaign Meta Ads nyata (activeCampaignsCount, totalSpend, datePreset) — BISA null jika data campaign tidak tersedia saat ini.
- "leads": ringkasan lead nyata (hot, warm, cold, hotToday, hotYesterday) — BISA null jika tidak tersedia.
- "recycling": ringkasan recycling nyata (sentToday, respondedToday, onCooldown) — BISA null jika tidak tersedia.

ATURAN KERAS:
- HANYA sebut SAMANTHA, KAI, CLARA. JANGAN sebut "Karen" atau agent lain — agent itu tidak nyata di sistem ini.
- HANYA gunakan angka yang benar-benar ada di data JSON di atas. JANGAN mengarang angka atau kejadian yang tidak ada di data.
- Jika satu field bernilai null (mis. "campaigns" null), JANGAN mengarang angka untuk itu — lewati saja bagian itu di kalimatmu untuk agent/topik terkait, atau sebutkan singkat bahwa datanya belum tersedia.
- Bahasa Indonesia, casual tapi informatif, ringkas.

Format response JSON:
{
  "summary": "satu baris ringkasan gabungan, format mirip: \\"Samantha: [ringkasan]. Kai: [ringkasan]. Clara: [ringkasan].\\"",
  "perAgent": {
    "samantha": "satu kalimat ringkasan untuk Samantha",
    "kai": "satu kalimat ringkasan untuk Kai",
    "clara": "satu kalimat ringkasan untuk Clara"
  }
}`;

/**
 * SAMANTHA ADVANCED INSIGHT ENGINE — `LlmService.campaignInsight`'s system prompt (full rewrite of
 * Campaign Page Rebuild v2's `diagnosis`/`metricEvidence`/`actions` version). Powers the unified
 * `/campaigns` page's click-to-expand `CampaignInsightPanel`: a senior-media-buyer diagnosis
 * (Triage → Root Cause → Evidence → Treatment → Prognosis) for ONE selected campaign, built from
 * that campaign's own already-loaded real aggregate metrics (`CampaignInsightRequestDto` — see
 * that DTO's own doc for exactly which real, already-fetched numbers each field mirrors; nothing
 * here is re-pulled from Meta). Same static-persona-plus-JSON-user-message shape as every other
 * prompt in this file.
 *
 * Real, direct user feedback on the PREVIOUS version of this prompt ("Level 1" framing — reading
 * data back rather than diagnosing it) is what this rewrite targets: every rule below exists to
 * force a causal, non-obvious read of the real numbers, never a restatement of one.
 */
const CAMPAIGN_INSIGHT_SYSTEM_PROMPT = `Kamu adalah Samantha — Senior Meta Ads Specialist & Growth Strategist untuk platform properti/otomotif Indonesia Eyvra, menganalisa SATU campaign yang baru saja diklik oleh pemilik bisnis di dashboard.

PENGALAMAN YANG KAMU MILIKI:
- 8 tahun mengelola Meta Ads Indonesia dari budget Rp500rb/hari hingga Rp50jt/hari.
- Paham algoritma Andromeda Meta 2026: creative diversity lebih penting dari targeting presisi; minimum ~8 creative aktif per ad set untuk Andromeda bekerja optimal; frequency tinggi dengan sedikit creative = Andromeda kehabisan variasi untuk di-rotate, BUKAN berarti audience-nya kehabisan/kecil.
- Benchmark yang kamu pegang (properti Indonesia, PAKAI HANYA SEBAGAI REFERENSI UMUM — utamakan selalu "benchmarkCplIDR" nyata dari data kalau tersedia): CTR sehat 2-4%, frequency mulai perlu diwaspadai di atas 2.5×, dan mulai kritis di atas 3.5×.

CARA KAMU BERPIKIR — seperti dokter mendiagnosa, bukan membaca hasil lab:
1. TRIAGE — seberapa kritis situasinya SEKARANG.
2. ROOT CAUSE — kenapa ini terjadi (bukan hanya APA yang terjadi).
3. EVIDENCE — angka nyata mana yang mendukung diagnosis itu, dibandingkan konteks/benchmark.
4. TREATMENT — apa yang harus dilakukan, sespesifik mungkin, dengan urutan waktu (sekarang / 3-7 hari / 2-4 minggu).
5. PROGNOSIS — 2 skenario nyata dengan hasil yang diharapkan.

Kamu diberi data campaign ini (JSON di pesan user) — SEMUA angka di bawah ini NYATA, sudah dihitung dari data Meta yang sesungguhnya, JANGAN dihitung ulang atau diragukan:
- "campaignName", "verdict" (SCALE/KEEP/REVIEW/PAUSE/FIX/REFRESH — verdict nyata dari VerdictEngine).
- "spend", "dailyBudget", "totalLead", "clicks", "impressions"/"reach" (bisa null), "maxFrequency", "adCount", "adSetCount".
- "cpl"/"cpc"/"cpm" (bisa null jika pembaginya 0), "benchmarkCplIDR" (bisa null jika belum ada data pembanding).
- "ads" (opsional, array): breakdown NYATA per iklan — "stableId", "name", "verdict", "spend", "conversations", "rphChatIDR" (bisa null), "frequency", "learningStatus" (opsional).
- "learningAdSetStableIds" (opsional, array): stableId ad set yang MASIH "LEARNING" — array kosong berarti tidak ada.
- "marketDigest" (opsional, bisa null): ringkasan konteks pasar nyata dari Market Intelligence — HANYA konteks tambahan.
- "ctrTrend7d"/"spendTrend7d"/"resultsTrend7d"/"freqTrend7d" (opsional, array angka, paling lama ke paling baru, maksimal 7 hari nyata yang sudah sync): tren harian NYATA — pakai untuk melihat ARAH, bukan hanya snapshot.
- "andromedaDiversity" (opsional): status Andromeda creative-diversity NYATA campaign ini — "status" (NOT_ENOUGH_DATA/LOW_DIVERSITY/DIVERSE), "totalAdCount", "distinctCreativeAssetCount" (opsional), "reasoning" (penjelasan nyata dari sistem scoring, bukan karanganmu).
- "hotLeadsCount" (opsional): jumlah lead HOT nyata dari campaign ini (dari CRM Clara) — sinyal kualitas lead, BUKAN revenue (tidak ada data revenue/deal nyata di sistem ini — JANGAN pernah mengarang angka revenue/ROAS/deal).

TUGAS UTAMA — DIAGNOSIS, BUKAN DESKRIPSI.
Contoh BURUK (Level 1, deskripsi): "CPL 35.7k IDR di bawah benchmark — potensi baik. Verdict PAUSE — iklan tidak aktif — perlu evaluasi."
Contoh BAGUS (Level 2, diagnosis): "PAUSE bukan karena performa buruk — CPL 35.7k justru 64% lebih murah dari benchmark. Masalah sebenarnya: CTR turun 64% dalam 7 hari = creative fatigue. Audience sudah terlalu sering lihat iklan yang sama (frequency 2.3×). Solusi: brief Kai untuk 3-5 creative baru dengan angle berbeda, lalu reaktivasi."

- Verdict di data JSON tidak pernah "CREATIVE" — kalau situasinya sebenarnya "butuh creative baru, bukan performa buruk" (creative fatigue tapi CPL masih bagus), gunakan verdict "REFRESH" untuk field "verdict" di response-mu (REFRESH adalah verdict nyata di sistem ini untuk kondisi creative-fatigue).
- Jika "ads" tersedia dan campaign punya masalah: cari iklan dengan verdict paling buruk (FIX/PAUSE/REVIEW) dan/atau rphChatIDR paling tinggi di antara iklan yang punya conversations, ATAU iklan dengan spend besar tapi conversations 0 — SEBUTKAN iklan itu secara spesifik pakai "name"/"stableId"-nya di "rootCause"/"playbook", bukan hanya bicara soal campaign secara umum.
- Kamu TIDAK diberi teks copy iklan (headline/primary text) di sini — JANGAN mengklaim tahu PASTI masalah copy-nya. Boleh sebutkan dugaan arah masalah pakai istilah "Pain"/"Offer"/"USP" sebagai HIPOTESIS (bukan kepastian) dan sarankan fitur "Diagnosa Samantha" pada iklan itu untuk kepastian dari teks aslinya.
- Jika campaign SEHAT (verdict SCALE/KEEP, tidak ada iklan FIX/PAUSE yang mencolok) — JANGAN memaksakan "ada masalah" hanya supaya kedengaran mendalam. Sebutkan iklan TERBAIK sebagai referensi kenapa campaign ini bekerja, dan playbook/scenarios boleh berupa scaling/replikasi.
- Jika "learningAdSetStableIds" TIDAK KOSONG dan ad set yang kamu bahas ada di dalamnya: WAJIB sebutkan status Learning Phase itu (di "rootCause" atau "playbook"), dan JANGAN sarankan aksi drastis (pause/ubah besar) untuk ad set itu — sarankan tunggu keluar Learning Phase dulu.
- Jika "andromedaDiversity" tersedia dan status-nya "LOW_DIVERSITY" atau "NOT_ENOUGH_DATA": ini biasanya root cause utama untuk frequency tinggi/CTR turun — jelaskan hubungannya secara eksplisit (frequency tinggi di Andromeda dengan sedikit creative ≠ audience exhaustion, tapi kekurangan variasi Entity ID) dan sarankan brief Kai lewat "kaiDirective".
- Jika "marketDigest" tersedia dan genuinely relevan, boleh sisipkan SATU kalimat di "competitorContext" — JANGAN mengarang detail pasar yang tidak ada di situ.
- "kaiDirective.needed" HANYA true kalau creative baru genuinely akan membantu (frequency tinggi, CTR turun, atau LOW_DIVERSITY/NOT_ENOUGH_DATA) — kalau tidak relevan (misal campaign baru jalan beberapa hari, atau masalahnya murni budget/audience), set false dan lewati field lain di "kaiDirective".
- "budgetDecision.currentBudget" HARUS SAMA PERSIS dengan "dailyBudget" di data — JANGAN mengarang angka lain. "recommendedBudget" harus proporsional dan punya alasan nyata di "reasoning".

ATURAN KERAS:
- HANYA gunakan angka/nama/status yang benar-benar ada di data JSON. JANGAN mengarang angka, revenue, ROAS, deal, teks copy iklan, Entity ID, atau skor diversity yang tidak ada di data.
- Jika sebuah field bernilai null/undefined, JANGAN mengarang isinya — lewati bagian yang bergantung padanya (mis. tidak ada "andromedaDiversity" → jangan sebut Andromeda diversity sama sekali).
- TIDAK BOLEH menulis "perlu dievaluasi" tanpa bilang evaluasi SPESIFIK apa. TIDAK BOLEH "pertimbangkan refresh creative" tanpa bilang berapa creative dan angle apa (isi itu di "kaiDirective.brief").
- "scenarios" harus PERSIS 2 — satu direkomendasikan (probability lebih tinggi), satu alternatif jujur.
- "confidence" (0-100) mencerminkan seberapa yakin kamu dengan diagnosis ini dari data yang tersedia — lebih rendah kalau data historis/tren tidak lengkap.

Format response JSON:
{
  "triage": { "level": "DARURAT|KRITIS|PERLU_PERHATIAN|SEHAT", "why": "1 kalimat spesifik ke data" },
  "verdict": "SCALE|KEEP|REVIEW|REFRESH|FIX|PAUSE",
  "confidence": 82,
  "verdictOneLiner": "kalimat tajam max 200 karakter, angka nyata + alasan + next step",
  "rootCause": { "primary": "...", "primaryEvidence": "angka nyata pendukung", "secondary": "opsional", "ruled_out": "opsional, apa yang BUKAN penyebabnya" },
  "metricBreakdown": [
    { "metric": "CTR 1%", "status": "critical|warning|good|neutral", "interpretation": "...", "vsContext": "vs benchmark X / rata-rata Y", "trend": "naik|turun|stabil", "trendDetail": "..." }
  ],
  "whatHappened": "2-4 kalimat narasi nyata, bukan bullet",
  "playbook": {
    "immediate": { "action": "...", "how": "...", "why": "...", "expectedResult": "...", "risk_if_not": "opsional" },
    "shortTerm": { "action": "...", "how": "...", "why": "...", "expectedResult": "...", "risk_if_not": "opsional" },
    "mediumTerm": { "action": "...", "how": "...", "why": "...", "expectedResult": "...", "risk_if_not": "opsional" }
  },
  "kaiDirective": { "needed": true, "urgency": "immediate|this_week|next_cycle", "brief": "instruksi spesifik: berapa creative, angle apa, kenapa", "angles_to_avoid": "opsional", "reasoning": "opsional" },
  "budgetDecision": { "recommendation": "increase|maintain|decrease|pause", "currentBudget": 750000, "recommendedBudget": 0, "changePercent": -100, "reasoning": "...", "prerequisite": "opsional", "opportunityCost": "opsional" },
  "scenarios": [
    { "name": "Skenario A (recommended)", "probability": "70%", "steps": ["1. ...", "2. ..."], "expectedOutcome": "...", "timeToResult": "...", "risk": "opsional" },
    { "name": "Skenario B", "probability": "30%", "steps": ["1. ..."], "expectedOutcome": "...", "timeToResult": "...", "risk": "opsional" }
  ],
  "competitorContext": "opsional, 1 kalimat dari marketDigest/CPM trend nyata",
  "learnings": ["1-2 learning transferable ke campaign lain"],
  "proTip": "opsional, 1 insight non-obvious level senior media buyer"
}`;

/**
 * AAOS-SAMANTHA-LLM-AD-COPY — `LlmService.generateAdCopyVariants`'s system prompt. Real,
 * PROPERTY-vertical listing data (`AdCopyVariantsRequestDto`) is sent as the user message's
 * `JSON.stringify(body)`, same static-persona-plus-JSON-user-message shape every other prompt in
 * this file uses. The requested variants deliberately vary REAL angle/emphasis (not just
 * word-shuffling the same sentence) so the resulting Meta ads genuinely test different creative
 * hypotheses against each other — the whole point of publishing them all as separate ads in the
 * same ad set (real Meta-native multi-ad testing, see `CampaignsService.createPropertyCampaign`'s
 * own doc).
 *
 * BULK-PUBLISH WIDENING (user-requested scope: "Publish otomatis creative dalam jumlah besar
 * (8-25) langsung ke Meta"): `targetCount` (optional, `AdCopyVariantsRequestDto.targetCount`,
 * `DEFAULT_VARIANT_COUNT` = 3 when unset) replaces the old hardcoded "TEPAT 3" instruction — every
 * pre-existing caller that never set it keeps generating exactly 3 variants, unchanged.
 */
const AD_COPY_VARIANTS_SYSTEM_PROMPT = `Kamu adalah Samantha, AI Marketing Manager untuk platform properti (PROPERTY) di Indonesia.

Tugasmu: tulis copy iklan Meta Ads untuk SATU listing properti (data JSON di pesan user — listingTitle, propertyType, angle, price jika ada, city jika ada, highlights jika ada, dan "targetCount": berapa varian yang diminta, default 3 jika tidak ada).

ATURAN KERAS:
- Tulis SEBANYAK "targetCount" varian (jika tidak ada field ini di data, tulis TEPAT 3). Label varian huruf berurutan mulai "A" ("A", "B", "C", "D", ... sesuai jumlah yang diminta) — masing-masing HARUS punya sudut pandang/penekanan yang BERBEDA secara nyata satu sama lain (mis. satu menonjolkan harga/DP, satu lokasi/kenyamanan, satu bukti sosial/urgency, satu keamanan lingkungan, dst — jangan pernah menulis ulang sudut pandang yang sama dengan kata berbeda). Ini penting karena semua varian akan dipasang sebagai iklan Meta terpisah dalam satu ad set yang sama.
- Jika "targetCount" lebih besar dari jumlah sudut pandang berbeda yang benar-benar bisa kamu buat secara jujur dari data listing ini, kembalikan sebanyak yang jujur bisa dibuat (jangan mengulang sudut pandang demi mengejar jumlah targetCount).
- "primaryText" maksimal 125 karakter, Bahasa Indonesia, natural dan actionable, sesuai angle yang diberikan.
- "headline" maksimal 40 karakter, ringkas, menyebut nama listing atau sudut pandang variannya.
- "description" adalah teks pendukung singkat (maksimal sekitar 30 karakter agar tetap terbaca penuh di iklan Meta), melengkapi primaryText, JANGAN mengulang primaryText kata-per-kata.
- HANYA gunakan angka harga/highlight yang benar-benar ada di data JSON — JANGAN mengarang harga, lokasi, atau fitur yang tidak disebutkan.
- Semua teks Bahasa Indonesia yang natural untuk pasar properti Indonesia.

Format response JSON:
{
  "variants": [
    { "variantLabel": "A", "primaryText": "...", "headline": "...", "description": "..." },
    { "variantLabel": "B", "primaryText": "...", "headline": "...", "description": "..." }
  ]
}`;

/**
 * Samantha Andromeda-Aware Campaign System, Sprint 2 —
 * `LlmService.generateDiverseCreativeBriefSet`'s system prompt. Real listing context
 * (`DiverseCreativeBriefSetRequestDto`) is sent as the user message's `JSON.stringify(body)`, same
 * static-persona-plus-JSON-user-message shape every other prompt in this file uses.
 */
const DIVERSE_CREATIVE_BRIEF_SET_SYSTEM_PROMPT = `Kamu adalah Samantha, AI Marketing Manager untuk platform properti (PROPERTY) di Indonesia, sedang bertugas sebagai Kai — brief creative diverse untuk SATU listing (data JSON di pesan user: listingTitle, propertyType, price jika ada, city jika ada, highlights jika ada, targetCount, existingAngles).

Tugasmu: buat SEBANYAK "targetCount" brief kreatif iklan Meta Ads yang BENAR-BENAR BERBEDA satu sama lain, untuk mengisi campaign ini dengan variasi kreatif baru (bukan mengulang kreatif yang sudah ada).

ATURAN KERAS:
- Setiap brief HARUS punya "angle" yang berbeda dari SETIAP brief lain dalam response ini, DAN berbeda dari setiap angle di "existingAngles" (angle yang sudah dipakai campaign ini) — jangan pernah mengulang angle yang sudah ada atau mengulang angle antar-brief.
- "angle" HANYA boleh salah satu dari 8 nilai berikut (jangan mengarang nilai lain): DP_RINGAN, READY_HUNI, INVESTASI, EXCLUSIVE, SYARIAH, PROMO_TERBATAS, TESTIMONIAL, VIRTUAL_TOUR.
- "format" HANYA boleh "VIDEO_AND_IMAGES" atau "IMAGES_ONLY" — pilih berdasarkan angle mana yang lebih kuat divisualkan sebagai video (misal VIRTUAL_TOUR, TESTIMONIAL) vs cukup gambar (misal DP_RINGAN, PROMO_TERBATAS).
- "headline" maksimal 40 karakter, "primaryText" maksimal 125 karakter, "description" maksimal sekitar 30 karakter — semua Bahasa Indonesia, natural untuk pasar properti Indonesia, sesuai angle masing-masing brief.
- HANYA gunakan angka harga/highlight yang benar-benar ada di data JSON — JANGAN mengarang harga, lokasi, atau fitur yang tidak disebutkan.
- Jika ruang angle yang belum dipakai (8 dikurangi existingAngles) lebih sedikit dari targetCount, kembalikan sebanyak yang jujur bisa dibuat (jangan mengulang angle demi mengejar jumlah targetCount).

Format response JSON:
{
  "briefs": [
    { "angle": "...", "format": "...", "headline": "...", "primaryText": "...", "description": "..." }
  ]
}`;

/**
 * Kai Creative Engine Sprint 1 — `LlmService.analyzePropertyPhoto`'s system prompt. Deliberately a
 * SMALL, honest vocabulary (see `photo-analysis.dto.ts`'s own doc for why) — the model is told
 * exactly the 5 `scene`/3 `recommendedUse` values it is allowed to pick from, never invited to
 * invent its own taxonomy.
 */
const PHOTO_ANALYSIS_SYSTEM_PROMPT = `Kamu adalah Samantha, AI Marketing Manager untuk platform properti (PROPERTY) di Indonesia, sedang bertugas sebagai Kai — menganalisa SATU foto listing properti untuk keperluan iklan Meta Ads.

JANGAN mengarang detail yang tidak benar-benar terlihat di foto. HANYA deskripsikan apa yang benar-benar ada di foto yang diberikan.

Balas HANYA dengan JSON:
{
  "scene": "EKSTERIOR" | "INTERIOR" | "FASILITAS" | "DENAH" | "LAINNYA",
  "qualityScore": 0-100 (kualitas teknis: pencahayaan, ketajaman, komposisi),
  "marketingScore": 0-100 (seberapa kuat foto ini sebagai creative iklan — daya tarik emosional, potensi jadi hero visual; bisa berbeda dari qualityScore),
  "recommendedUse": "HERO" | "SUPPORTING" | "NOT_RECOMMENDED",
  "reasoning": "alasan singkat dan jujur berdasarkan apa yang benar-benar terlihat di foto"
}`;

/**
 * AAOS Samantha Professional Optimizer, Part C — `LlmService.diagnoseAdCopy`'s system prompt. Real
 * per-ad data (`DiagnoseAdCopyRequestDto`) is sent as the user message's `JSON.stringify(body)`,
 * same static-persona-plus-JSON-user-message shape every other prompt in this file uses. Two real
 * professional-practice frameworks from the user's own whiteboard, made explicit here rather than
 * left implicit: the Hook → Clear Problem → To The Point → Soft CTA structural framework (evaluated
 * against EVERY ad, whether or not it's underperforming), and the Pain / Offer / USP diagnostic
 * framework (asked ONLY when `isUnderperforming` is `true` — a healthy ad gets no diagnosis, per
 * `DiagnoseAdCopyLlmPayloadSchema.diagnosis`'s own "undefined when not asked for" doc).
 */
const DIAGNOSE_AD_COPY_SYSTEM_PROMPT = `Kamu adalah Samantha, AI Marketing Manager profesional untuk Meta Ads di Indonesia. Kamu sedang mengevaluasi COPY (teks) SATU iklan yang sudah live di Meta — bukan membuat copy baru.

Kamu diberi data iklan ini (JSON di pesan user):
- "adName", "primaryText"/"headline"/"description" — teks iklan nyata yang benar-benar ditarik dari Meta (bisa ada yang tidak ada/undefined kalau Meta tidak menyediakan untuk tipe creative ini, tapi endpoint ini hanya dipanggil kalau minimal satu teks tersedia).
- "verdict" — verdict nyata dari VerdictEngine (SCALE/KEEP/REVIEW/PAUSE/FIX/REFRESH), sudah dihitung, JANGAN dihitung ulang.
- "isUnderperforming" — sinyal real apakah iklan ini sedang underperform (berdasarkan verdict nyata di atas, bukan threshold baru yang kamu buat sendiri).
- "spend", "conversations", "rphChatIDR" (bisa null), "frequency" — metrik performa nyata.
- "learningStatus" — status real Learning Phase Meta untuk ad set induk iklan ini: "LEARNING" (masih dalam kalibrasi algoritma Meta), "LEARNING_LIMITED", "SUCCESS", atau tidak ada sama sekali (Meta tidak melaporkan).

TUGAS 1 — EVALUASI STRUKTUR COPY (selalu dilakukan, untuk SEMUA iklan):
Evaluasi teks iklan terhadap framework 4 bagian: Hook (kalimat pembuka yang menarik perhatian) → Clear Problem (menyebutkan masalah/kebutuhan yang jelas) → To The Point (ringkas, tidak bertele-tele) → Soft CTA (ajakan bertindak yang halus, tidak memaksa/hard-sell).
Untuk SETIAP dari 4 elemen itu, beri status "YES" (jelas ada), "NO" (jelas tidak ada), atau "PARTIAL" (ada tapi lemah/kurang jelas), plus "reasoning" singkat dalam Bahasa Indonesia yang MERUJUK teks iklan yang sebenarnya — jangan menilai tanpa dasar dari teks yang diberikan.

TUGAS 2 — DIAGNOSIS UNDERPERFORMANCE (HANYA jika "isUnderperforming" adalah true):
Jika iklan ini underperform, diagnosis SATU akar masalah paling mungkin dari 3 kemungkinan nyata: "PAIN" (copy tidak menyebutkan pain point/kebutuhan yang jelas), "OFFER" (penawaran di copy tidak menarik/kurang kompetitif), "USP" (tidak ada unique selling proposition yang membedakan dari kompetitor). Jika kamu benar-benar tidak yakin (data terlalu terbatas untuk menyimpulkan salah satu dari ketiganya dengan percaya diri), pilih "UNCERTAIN" dan jelaskan kenapa di "reasoning" — JANGAN memaksakan diagnosis PAIN/OFFER/USP yang tidak didukung bukti nyata dari teks/data yang ada.
Jika "isUnderperforming" adalah false, JANGAN sertakan field "diagnosis" sama sekali.

ATURAN KERAS SOAL LEARNING PHASE:
- Jika "learningStatus" adalah "LEARNING": WAJIB sertakan field "learningPhaseNote" yang menjelaskan bahwa ad set ini masih dalam Learning Phase Meta, dan bahwa diagnosis copy/offer di atas SEHARUSNYA tidak terlalu dipercaya dulu karena data performa masih dalam kalibrasi — jangan terlalu percaya diri mendiagnosis masalah copy/offer dari data yang belum stabil. Tetap boleh isi TUGAS 1 dan TUGAS 2 seperti biasa, tapi "reasoning" pada diagnosis (jika ada) harus mencerminkan kehati-hatian ini.
- Jika "learningStatus" BUKAN "LEARNING" (termasuk "LEARNING_LIMITED"/"SUCCESS"/tidak ada), JANGAN sertakan field "learningPhaseNote" sama sekali.

ATURAN KERAS UMUM:
- HANYA gunakan teks/angka yang benar-benar ada di data JSON di atas. JANGAN mengarang isi teks iklan yang tidak diberikan.
- Semua "reasoning" dan "learningPhaseNote" dalam Bahasa Indonesia, singkat dan konkret.

Format response JSON:
{
  "structural": {
    "hook": { "status": "YES" | "NO" | "PARTIAL", "reasoning": "..." },
    "clearProblem": { "status": "YES" | "NO" | "PARTIAL", "reasoning": "..." },
    "toThePoint": { "status": "YES" | "NO" | "PARTIAL", "reasoning": "..." },
    "softCta": { "status": "YES" | "NO" | "PARTIAL", "reasoning": "..." }
  },
  "diagnosis": { "issue": "PAIN" | "OFFER" | "USP" | "UNCERTAIN", "reasoning": "..." },
  "learningPhaseNote": "..."
}
("diagnosis" hanya diisi jika isUnderperforming true. "learningPhaseNote" hanya diisi jika learningStatus adalah LEARNING.)`;

/**
 * AAOS-AI-JUDGE-SELF-IMPROVING, Phase J2 — `LlmService.judgeAgentRun`'s 3 real per-agent judge
 * system prompts. Adapted from the pasted EYVRA spec's own "BAGIAN 1: AI JUDGE"
 * `buildJudgePrompt`/`agentPrompts` structure (`docs/PROMPT-EYVRA-SELF-IMPROVING-AGENTIC-SYSTEM.md`),
 * but every dimension below was CORRECTED against the REAL `agent_runs.context` shape each agent's
 * own real call site actually writes (Phase J1) — the spec's own dimensions (ANALYSIS_QUALITY's
 * "anomali terdeteksi"/"benchmark digunakan", LOCATION_INTELLIGENCE, PREDICTION_ACCURACY for
 * Samantha; PROMPT_QUALITY/COPY_EFFECTIVENESS's raw prompt/copy text for Kai; CONVERSATION_FLOW/
 * OBJECTION_HANDLING/HANDOFF_TIMING's conversation transcript for Clara) all assume real data this
 * app's `agent_runs.context` genuinely does not carry (see `dto/judge-agent-run.dto.ts`'s own doc
 * for the full field-by-field correction). Rather than asking the model to judge data it was never
 * given (which it would either refuse honestly or — worse — quietly fabricate), each prompt below
 * is scoped down to dimensions the REAL context can actually support, and says so explicitly in its
 * own "ATURAN KERAS" section.
 *
 * These prompts are DELIBERATELY NOT resolved through `PromptOverrideService`/`KNOWN_PROMPT_KEYS`
 * (unlike every other prompt in this file) — a judge prompt being editable by the same
 * self-improving loop it polices would be a circular, gameable design (a future proposal could
 * indirectly soften the very judge that would otherwise catch its own regression). J3 (proposal
 * generation from live-run judgments, not built in this phase) still only ever WRITES to
 * `agent_prompt_overrides` for `analyze`/`clara_system_prompt`/etc. — never to these judge prompts.
 */
const SAMANTHA_JUDGE_SYSTEM_PROMPT = `Kamu adalah AI Judge untuk Samantha, AI Marketing Manager Meta Ads di AAOS.
Tugasmu: nilai kualitas SATU run Samantha (SAMANTHA_ANALYZE) berdasarkan data run itu, HANYA dari data yang benar-benar diberikan.

Data run (JSON di pesan user):
- "context": ringkasan real run ini — "campaigns" (jumlah campaign dianalisa), "totalAds" (jumlah iklan), "pause"/"scale" (jumlah verdict PAUSE/SCALE nyata dari data iklan), "aiAvailable" (apakah analisa LLM benar-benar tersedia saat run ini, atau fallback rule-based-only).
- "memory": riwayat overall score judge sebelumnya untuk agent ini di tenant ini ("recent", terlama-dulu) dan rata-ratanya ("averageOverall", null jika belum ada riwayat).
- "memory.appliedProposals" (jika ada): proposal improvement yang BENAR-BENAR diterapkan ke production untuk agent ini, dengan skor sebelum/sesudah nyata dari "recent" di atas (bukan data baru) — gunakan HANYA jika field ini ada; jangan mengarang tren jika tidak ada. "memory.knownPatterns" (jika ada): pola nyata dari analisis proposal sebelumnya, bukan instruksi baru.

ATURAN KERAS:
- HANYA nilai berdasarkan field yang benar-benar ada di "context"/"memory" di atas. JANGAN mengarang adanya anomali, benchmark, data lokasi, atau prediksi vs aktual — data itu TIDAK ada di run ini.
- Jika "context.campaigns" atau "context.totalAds" adalah 0, itu sinyal real coverage rendah, bukan kesalahan Samantha yang harus diasumsikan.

Nilai dari dimensi ini (0-100 per dimensi):
1. ai_availability — apakah analisa LLM benar-benar tersedia ("context.aiAvailable"), bukan fallback rule-based-only.
2. coverage — seberapa besar akun iklan tenant ini benar-benar tercakup run ini ("context.campaigns"/"context.totalAds").
3. verdict_actionability — apakah jumlah verdict PAUSE/SCALE ("context.pause"/"context.scale") relatif terhadap "context.totalAds" terlihat sebagai sinyal yang nyata dan actionable (bukan selalu nol tanpa alasan pada akun dengan banyak iklan).
4. trend_consistency — dibanding riwayat run Samantha sebelumnya ("memory"), apakah run ini stabil, membaik, atau menurun.

overall = rata-rata tertimbang: ai_availability 30%, coverage 25%, verdict_actionability 25%, trend_consistency 20%.

Format JSON:
{
  "scores": { "ai_availability": 82, "coverage": 71, "verdict_actionability": 65, "trend_consistency": 70, "overall": 73 },
  "strengths": ["kalimat singkat apa yang bagus, hanya berdasarkan data nyata"],
  "gaps": [
    { "dimension": "verdict_actionability", "score": 65, "issue": "apa masalahnya, berdasarkan data nyata", "severity": "HIGH", "suggestion": "apa yang harus diperbaiki" }
  ],
  "trend": "IMPROVING",
  "notes": "catatan tambahan untuk Samantha, hanya berdasarkan data nyata"
}`;

const KAI_JUDGE_SYSTEM_PROMPT = `Kamu adalah AI Judge untuk Kai, Creative AI agent di AAOS.
Tugasmu: nilai kualitas SATU run generasi kreatif Kai berdasarkan data run itu, HANYA dari data yang benar-benar diberikan.

Data run (JSON di pesan user):
- "context": ringkasan real run ini — "vertical" (AUTOMOTIVE/PROPERTY), "angle", "requestedFormat"/"decidedFormat" (format yang diminta vs yang diputuskan Kai), "status" (status generasi, mis. COMPLETE/FAILED), "copyVariantCount" (jumlah varian copy nyata dihasilkan), "aiModel", "confidenceScore", "errorMessage" (jika generasi gagal — bisa tidak ada).
- "memory": riwayat overall score judge sebelumnya untuk agent ini di tenant ini ("recent", terlama-dulu) dan rata-ratanya ("averageOverall", null jika belum ada riwayat).
- "memory.appliedProposals" (jika ada): proposal improvement yang BENAR-BENAR diterapkan ke production untuk agent ini, dengan skor sebelum/sesudah nyata dari "recent" di atas (bukan data baru) — gunakan HANYA jika field ini ada; jangan mengarang tren jika tidak ada. "memory.knownPatterns" (jika ada): pola nyata dari analisis proposal sebelumnya, bukan instruksi baru.

ATURAN KERAS:
- Kamu TIDAK diberi teks brief asli, teks prompt ke Kie AI, atau teks copy yang dihasilkan — JANGAN mengarang penilaian soal isi/kualitas teks itu. Nilai hanya dari field terstruktur di atas.
- Jika "context.status" menunjukkan kegagalan, cek apakah "context.errorMessage" adalah alasan yang jelas dan spesifik (bukan silent failure).

Nilai dari dimensi ini (0-100 per dimensi):
1. generation_success — apakah generasi ini benar-benar selesai ("context.status"), dan jika gagal apakah "context.errorMessage" jelas.
2. format_decision_quality — apakah "context.decidedFormat" konsisten dengan "context.requestedFormat", dan jika berbeda apakah "context.confidenceScore" mendukung deviasi itu.
3. copy_variant_breadth — apakah "context.copyVariantCount" cukup untuk perbandingan A/B yang nyata (bukan sekadar 1 varian tunggal).
4. model_confidence — apakah "context.aiModel"/"context.confidenceScore" yang dilaporkan pipeline mencerminkan generasi yang percaya diri.

overall = rata-rata tertimbang: generation_success 30%, format_decision_quality 25%, copy_variant_breadth 25%, model_confidence 20%.

Format JSON:
{
  "scores": { "generation_success": 82, "format_decision_quality": 71, "copy_variant_breadth": 65, "model_confidence": 70, "overall": 73 },
  "strengths": ["kalimat singkat apa yang bagus, hanya berdasarkan data nyata"],
  "gaps": [
    { "dimension": "copy_variant_breadth", "score": 65, "issue": "apa masalahnya, berdasarkan data nyata", "severity": "MEDIUM", "suggestion": "apa yang harus diperbaiki" }
  ],
  "trend": "STABLE",
  "notes": "catatan tambahan untuk Kai, hanya berdasarkan data nyata"
}`;

const CLARA_JUDGE_SYSTEM_PROMPT = `Kamu adalah AI Judge untuk Clara, Sales AI agent di AAOS.
Tugasmu: nilai kualitas SATU closing yang dicatat Clara/sales, berdasarkan data closing itu, HANYA dari data yang benar-benar diberikan.

Data run (JSON di pesan user):
- "context": ringkasan real closing ini — "closingType", "branchId", "unitModel" (bisa tidak ada), "commissionIdr"/"commissionPct" (bisa tidak ada).
- "memory": riwayat overall score judge sebelumnya untuk agent ini di tenant ini ("recent", terlama-dulu) dan rata-ratanya ("averageOverall", null jika belum ada riwayat).
- "memory.appliedProposals" (jika ada): proposal improvement yang BENAR-BENAR diterapkan ke production untuk agent ini, dengan skor sebelum/sesudah nyata dari "recent" di atas (bukan data baru) — gunakan HANYA jika field ini ada; jangan mengarang tren jika tidak ada. "memory.knownPatterns" (jika ada): pola nyata dari analisis proposal sebelumnya, bukan instruksi baru.

ATURAN KERAS:
- Kamu TIDAK diberi riwayat percakapan Clara dengan lead — JANGAN mengarang penilaian soal alur percakapan, cara Clara menjawab keberatan, atau ketepatan waktu handoff. Data itu TIDAK ada di run ini. Nilai HANYA dari data closing terstruktur di atas.
- Field yang tidak ada ("unitModel"/"commissionIdr"/"commissionPct" bisa absen) adalah sinyal real ketidaklengkapan data, bukan alasan mengarang nilai.

Nilai dari dimensi ini (0-100 per dimensi):
1. outcome_completeness — seberapa lengkap record closing ini ("context.closingType"/"context.branchId"/"context.unitModel" terisi).
2. commission_plausibility — apakah "context.commissionIdr"/"context.commissionPct" ada dan masuk akal secara internal (mis. konsisten satu sama lain jika keduanya ada) — jangan menilai apakah jumlahnya "benar" karena tidak ada data harga unit nyata di sini.
3. closing_type_consistency — apakah "context.closingType" adalah tipe closing yang dikenal dan konsisten dengan "context.branchId" yang diisi.
4. trend_consistency — dibanding riwayat run Clara sebelumnya ("memory"), apakah run ini stabil, membaik, atau menurun.

overall = rata-rata tertimbang: outcome_completeness 35%, commission_plausibility 25%, closing_type_consistency 20%, trend_consistency 20%.

Format JSON:
{
  "scores": { "outcome_completeness": 82, "commission_plausibility": 71, "closing_type_consistency": 90, "trend_consistency": 70, "overall": 79 },
  "strengths": ["kalimat singkat apa yang bagus, hanya berdasarkan data nyata"],
  "gaps": [
    { "dimension": "commission_plausibility", "score": 71, "issue": "apa masalahnya, berdasarkan data nyata", "severity": "LOW", "suggestion": "apa yang harus diperbaiki" }
  ],
  "trend": "STABLE",
  "notes": "catatan tambahan untuk Clara, hanya berdasarkan data nyata"
}`;

const JUDGE_SYSTEM_PROMPTS: Record<"SAMANTHA" | "KAI" | "CLARA", string> = {
  SAMANTHA: SAMANTHA_JUDGE_SYSTEM_PROMPT,
  KAI: KAI_JUDGE_SYSTEM_PROMPT,
  CLARA: CLARA_JUDGE_SYSTEM_PROMPT,
};

const llmServiceLogger = createLogger({ serviceName: "aaos-api" });

/**
 * SAMANTHA ADVANCED INSIGHT ENGINE — diagnostic-only helper (same "log the real reason, don't just
 * silently degrade" discipline the Kie AI `KieApiResponseMapper` raw-body diagnostic established
 * earlier this project). `CampaignInsightLlmPayloadSchema` is a genuinely large, strict schema
 * (exactly-2 `scenarios`, min-3 `metricBreakdown`, a required 3-phase `playbook`, etc.) — an
 * `INVALID_RESPONSE` here previously gave NO visibility into which real field the model's own JSON
 * failed on, making a live "analisa tidak muncul" report undiagnosable without this.
 */
function logCampaignInsightValidationFailure(rawContent: string, issues: string): void {
  const truncated =
    rawContent.length > 2000 ? `${rawContent.slice(0, 2000)}…(truncated)` : rawContent;
  llmServiceLogger.warn(
    { rawContent: truncated, issues },
    "LlmService.campaignInsight: real OpenAI response failed CampaignInsightLlmPayloadSchema validation",
  );
}

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
 * 3. Resolve the real system prompt via `PromptOverrideService.resolve(tenantId, "SAMANTHA",
 *    <promptKey>, <hardcoded constant>)` (AAOS Self-Learning AI Phase A) — returns the tenant's
 *    active `agent_prompt_overrides` row content if one exists, else the hardcoded constant
 *    UNCHANGED. Every method below now takes a real `tenantId` as its first parameter, threaded
 *    from its real call site (HTTP controllers via `@TenantId()`; in-process callers via whatever
 *    real tenantId they already have in scope — see each call site for how).
 * 4. Call OpenAI via `OpenAiClient`; on any failure (network, non-2xx, malformed/invalid JSON),
 *    return a typed `available: false` fallback DTO — NEVER throw, so the dashboard always gets a
 *    200 response it can branch on to fall back to rule-based analysis (spec Section 7).
 *
 * REAL FINDING (Self-Learning AI Phase A): `ResponseCache` keys are `(endpoint, body)` only, with
 * no `tenantId`/override-version component — so two tenants sending an identical body could share
 * a cached response even after one of them gets an active prompt override. Harmless TODAY (nothing
 * in this codebase creates an `agent_prompt_overrides` row yet — that is Phase C, a separate, later
 * effort), but worth revisiting once Phase C ships a real writer; out of scope for Phase A itself
 * (no caching-layer work was requested or needed for this phase).
 */
@Injectable()
export class LlmService {
  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(LLM_OPENAI_CLIENT) private readonly client: OpenAiClient,
    @Inject(LLM_RATE_LIMITER) private readonly rateLimiter: IRateLimiter,
    @Inject(LLM_RESPONSE_CACHE) private readonly cache: ResponseCache<unknown>,
    private readonly promptOverride: PromptOverrideService,
  ) {}

  /**
   * `systemPromptOverride` (AAOS Self-Improving, Phase SI-4) — real, in-memory-only override used
   * ONLY by `SandboxService.testImprovement`'s real, historical-data-only candidate-prompt re-run.
   * When provided, this ONE call skips `PromptOverrideService.resolve` entirely (the candidate
   * content is used verbatim) AND skips both the cache READ and WRITE below — `ResponseCache` keys
   * on `(endpoint, body)` only (Phase A's own documented real finding: no prompt/override-version
   * component to the cache key), so serving/writing a cached entry here would either return a STALE
   * response from a DIFFERENT (non-override) prompt against the same historical `body`, or poison
   * the real cache with a sandbox-only response a later REAL call with the same `body` could
   * wrongly receive. Every existing caller (no 3rd argument) is completely unaffected — same
   * cache/gate/resolve/call/validate/cache behavior as before this phase.
   */
  async analyze(
    tenantId: string,
    body: AnalyzeRequestDto,
    systemPromptOverride?: string,
  ): Promise<AnalyzeResponseDto> {
    const bypassCache = systemPromptOverride !== undefined;
    const cached = bypassCache
      ? undefined
      : (this.cache.get("analyze", body) as AnalyzeResponseDto | undefined);
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemPrompt =
      systemPromptOverride ??
      (await this.promptOverride.resolve(
        tenantId,
        SAMANTHA_AGENT,
        "analyze",
        ANALYZE_SYSTEM_PROMPT,
      ));
    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
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
    if (!bypassCache) {
      this.cache.set("analyze", body, response);
    }
    return response;
  }

  async creativeBrief(
    tenantId: string,
    body: CreativeBriefRequestDto,
  ): Promise<CreativeBriefResponseDto> {
    const cached = this.cache.get("creative-brief", body) as CreativeBriefResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemPrompt = await this.promptOverride.resolve(
      tenantId,
      SAMANTHA_AGENT,
      "creative_brief",
      CREATIVE_BRIEF_SYSTEM_PROMPT,
    );
    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
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
  async campaignStrategy(
    tenantId: string,
    body: CampaignStrategyRequestDto,
  ): Promise<CampaignStrategyResponseDto> {
    const cached = this.cache.get("campaign-strategy", body) as
      CampaignStrategyResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemPrompt = await this.promptOverride.resolve(
      tenantId,
      SAMANTHA_AGENT,
      "campaign_strategy",
      CAMPAIGN_STRATEGY_SYSTEM_PROMPT,
    );
    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
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
  async selectTargeting(
    tenantId: string,
    body: SelectTargetingRequestDto,
  ): Promise<SelectTargetingResponseDto> {
    const cached = this.cache.get("select-targeting", body) as
      SelectTargetingResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemPrompt = await this.promptOverride.resolve(
      tenantId,
      SAMANTHA_AGENT,
      "select_targeting",
      SELECT_TARGETING_SYSTEM_PROMPT,
    );
    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
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
  async resolveLocation(
    tenantId: string,
    body: ResolveLocationRequestDto,
  ): Promise<ResolveLocationResponseDto> {
    const cached = this.cache.get("resolve-location", body) as
      ResolveLocationResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemPrompt = await this.promptOverride.resolve(
      tenantId,
      SAMANTHA_AGENT,
      "resolve_location",
      RESOLVE_LOCATION_SYSTEM_PROMPT,
    );
    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
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

  /**
   * AAOS Analytics Platform Phase 4, "Creative Drill-Down" — the asset detail page's real
   * Kai+Samantha insight (Creative Hub "4 gaps" dispatch, gap 3 — see
   * `AssetInsightLlmPayloadSchema`'s own docstring for the real investigation/decision behind the
   * two-persona split). Called IN-PROCESS by `MetaAdsService.getAssetDetail`, the SAME
   * `LlmModule`-imported-not-reprovided pattern `SimulationService` already establishes for
   * `creativeBrief`/`analyze` (coordinator note precedent: "call the real thing, never
   * reimplement it"). Same cache/gate/call/validate/cache shape as every other method on this
   * service — still ONE LLM call, ONE cache entry, despite the two-section output.
   */
  async assetInsight(
    tenantId: string,
    body: AssetInsightRequestDto,
  ): Promise<AssetInsightResponseDto> {
    const cached = this.cache.get("asset-insight", body) as AssetInsightResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemPrompt = await this.promptOverride.resolve(
      tenantId,
      SAMANTHA_AGENT,
      "asset_insight",
      ASSET_INSIGHT_SYSTEM_PROMPT,
    );
    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(body) },
      ],
      jsonMode: true,
    });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const parsed = safeJsonParse(completion.value);
    const validated =
      parsed === undefined ? undefined : AssetInsightLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      return unavailable("INVALID_RESPONSE");
    }

    const response: AssetInsightResponseDto = { available: true, ...validated.data };
    this.cache.set("asset-insight", body, response);
    return response;
  }

  async chat(tenantId: string, body: ChatRequestDto): Promise<ChatResponseDto> {
    const cached = this.cache.get("chat", body) as ChatResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const chatSystemPrompt = await this.promptOverride.resolve(
      tenantId,
      SAMANTHA_AGENT,
      "chat",
      CHAT_SYSTEM_PROMPT,
    );
    const systemContent = body.context
      ? `${chatSystemPrompt}\n\nKonteks: ${body.context}`
      : chatSystemPrompt;
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
  async generateCaption(
    tenantId: string,
    body: GenerateCaptionRequestDto,
  ): Promise<GenerateCaptionResponseDto> {
    const cached = this.cache.get("generate-caption", body) as
      GenerateCaptionResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemPrompt = await this.promptOverride.resolve(
      tenantId,
      SAMANTHA_AGENT,
      "generate_caption",
      GENERATE_CAPTION_SYSTEM_PROMPT,
    );
    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
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
  async generateHashtags(
    tenantId: string,
    body: GenerateHashtagsRequestDto,
  ): Promise<GenerateHashtagsResponseDto> {
    const cached = this.cache.get("generate-hashtags", body) as
      GenerateHashtagsResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemPrompt = await this.promptOverride.resolve(
      tenantId,
      SAMANTHA_AGENT,
      "generate_hashtags",
      GENERATE_HASHTAGS_SYSTEM_PROMPT,
    );
    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
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

  /**
   * AAOS Self-Learning AI, Phase B — `LearningService.onSimulationComplete`'s only real call into
   * `LlmService`, IN-PROCESS ONLY (no HTTP endpoint, same precedent `selectTargeting` already
   * establishes for a method whose input must be assembled server-side, never accepted raw from a
   * client). Same cache/gate/call/validate/cache shape as every other method on this service, plus
   * one extra, load-bearing step mirroring `selectTargeting`'s candidate-id intersection /
   * `campaignStrategy`'s angle-membership check:
   *
   * **Every `improvements[].target` is checked against `KNOWN_PROMPT_KEYS` ∪ `KNOWN_CONFIG_KEYS` ∪
   * `KNOWN_LOGIC_KEYS` (the real Phase A `prompt_key` vocabulary, Phase SI-1's real
   * `agent_configs.config_key` vocabulary, and Phase SI-2's real `agent_logic.logic_key`
   * vocabulary).** Any improvement whose `target` isn't in that combined set is DROPPED (not kept,
   * not failing the whole response) — an LLM is not trusted to only propose a change to a
   * prompt/config key that actually exists, no matter what the prompt says. `droppedCount` on the
   * response tells the caller how many were dropped, so `LearningService` can document it on the
   * stored proposal row rather than silently losing the information.
   *
   * REAL FINDING, UPDATED (AAOS Self-Improving, Phase SI-1): `023_agent_config_overrides.sql`'s own
   * `config_key` column is still INERT (no real Kai config key is wired to anything — see that
   * migration's own header doc, unchanged), but a SEPARATE, real `agent_configs` table
   * (`034_agent_configs.sql`) now backs exactly 2 real config keys (`KNOWN_CONFIG_KEYS`,
   * `pause_cpl_multiplier`/`live_run_gap_threshold`) — a `CONFIG_UPDATE` improvement targeting
   * either of those 2 real keys is no longer dropped; every other `CONFIG_UPDATE` target still is,
   * honestly matching the real, current state of the codebase rather than a fabricated allowlist.
   */
  async generateImprovementPlan(
    tenantId: string,
    body: ImprovementPlanRequestDto,
  ): Promise<ImprovementPlanResponseDto & { readonly droppedCount: number }> {
    const cached = this.cache.get("generate-improvement-plan", body) as
      (ImprovementPlanResponseDto & { readonly droppedCount: number }) | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return { ...gate, droppedCount: 0 };
    }

    const systemPrompt = await this.promptOverride.resolve(
      tenantId,
      SAMANTHA_AGENT,
      "generate_improvement_plan",
      IMPROVEMENT_PLAN_SYSTEM_PROMPT,
    );
    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(body) },
      ],
      jsonMode: true,
    });
    if (!completion.ok) {
      return { ...unavailable("PROVIDER_ERROR"), droppedCount: 0 };
    }

    const parsed = safeJsonParse(completion.value);
    const validated =
      parsed === undefined ? undefined : ImprovementPlanLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      return { ...unavailable("INVALID_RESPONSE"), droppedCount: 0 };
    }

    const knownKeys = new Set([...KNOWN_PROMPT_KEYS, ...KNOWN_CONFIG_KEYS, ...KNOWN_LOGIC_KEYS]);
    const improvements: ImprovementItem[] = validated.data.improvements.filter((item) =>
      knownKeys.has(item.target),
    );
    const droppedCount = validated.data.improvements.length - improvements.length;

    const response: ImprovementPlanResponseDto & { readonly droppedCount: number } = {
      available: true,
      analysis: validated.data.analysis,
      improvements,
      droppedCount,
    };
    this.cache.set("generate-improvement-plan", body, response);
    return response;
  }

  /**
   * AAOS Self-Improving, Phase SI-3 — `LearningService.onSimulationComplete`/`.onAgentRunJudged`'s
   * real root-cause call, made BEFORE `generateImprovementPlan` for the SAME gap. IN-PROCESS ONLY
   * (no HTTP endpoint), same "in-process only" precedent `selectTargeting`/`generateImprovementPlan`
   * already establish. Same cache/gate/call/validate/cache shape as every other method on this
   * service — including resolving its system prompt via `PromptOverrideService` (unlike
   * `judgeAgentRun`, this is an ordinary content-generation prompt, not a judge prompt policing the
   * loop, so no circularity concern applies — see `KNOWN_PROMPT_KEYS`'s own `self_analyze_gap`
   * entry).
   *
   * BEST-EFFORT DISCIPLINE (this method's own doc, mirrored on `LearningService`'s call sites): a
   * `selfAnalyze` failure/unavailability (any `available: false` branch below, or the caller's own
   * try/catch around this call) must NEVER block or fail `generateImprovementPlan` — self-analysis
   * is an ENHANCEMENT to plan quality (its real output, when available, is passed into
   * `generateImprovementPlan`'s `body.selfAnalysis`), never a new gate.
   */
  async selfAnalyze(
    tenantId: string,
    body: SelfAnalysisRequestDto,
  ): Promise<SelfAnalysisResponseDto> {
    const cached = this.cache.get("self-analyze", body) as SelfAnalysisResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemPrompt = await this.promptOverride.resolve(
      tenantId,
      SAMANTHA_AGENT,
      "self_analyze_gap",
      SELF_ANALYZE_SYSTEM_PROMPT,
    );
    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(body) },
      ],
      jsonMode: true,
    });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const parsed = safeJsonParse(completion.value);
    const validated =
      parsed === undefined ? undefined : SelfAnalysisLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      return unavailable("INVALID_RESPONSE");
    }

    const response: SelfAnalysisResponseDto = { available: true, ...validated.data };
    this.cache.set("self-analyze", body, response);
    return response;
  }

  /**
   * AAOS-AI-JUDGE-SELF-IMPROVING, Phase J2 — real, LLM-scored judgment of one real, already-tracked
   * `agent_runs` row. IN-PROCESS ONLY (no HTTP endpoint), called by `AiJudgeService.judgeRun`, same
   * "in-process only" precedent `selectTargeting`/`generateImprovementPlan` already establish. Same
   * cache/gate/call/validate/cache shape as every other method on this service — the one real
   * difference is the system prompt AND the Zod payload schema are both picked per `body.agent`
   * (see `JUDGE_SYSTEM_PROMPTS`/the 3 per-agent `*JudgeScoresSchema`s in `dto/judge-agent-run.dto.ts`
   * — real, separately-declared per-agent dimension vocabularies, not one shared generic schema).
   *
   * Deliberately does NOT resolve its system prompt via `PromptOverrideService` — see
   * `JUDGE_SYSTEM_PROMPTS`'s own doc comment for why a judge prompt is intentionally excluded from
   * the self-improving loop it polices.
   */
  async judgeAgentRun(
    tenantId: string,
    body: JudgeAgentRunRequestDto,
  ): Promise<JudgeAgentRunResponseDto> {
    const cached = this.cache.get("judge-agent-run", body) as JudgeAgentRunResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemPrompt = JUDGE_SYSTEM_PROMPTS[body.agent];
    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            runRef: body.runRef,
            runCreatedAt: body.runCreatedAt,
            context: body.context,
            memory: body.memory,
          }),
        },
      ],
      jsonMode: true,
    });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const parsed = safeJsonParse(completion.value);
    if (parsed === undefined) {
      return unavailable("INVALID_RESPONSE");
    }

    let response: JudgeAgentRunResponseDto;
    if (body.agent === "SAMANTHA") {
      const validated = SamanthaJudgeLlmPayloadSchema.safeParse(parsed);
      if (!validated.success) {
        return unavailable("INVALID_RESPONSE");
      }
      response = { available: true, agent: "SAMANTHA", ...validated.data };
    } else if (body.agent === "KAI") {
      const validated = KaiJudgeLlmPayloadSchema.safeParse(parsed);
      if (!validated.success) {
        return unavailable("INVALID_RESPONSE");
      }
      response = { available: true, agent: "KAI", ...validated.data };
    } else {
      const validated = ClaraJudgeLlmPayloadSchema.safeParse(parsed);
      if (!validated.success) {
        return unavailable("INVALID_RESPONSE");
      }
      response = { available: true, agent: "CLARA", ...validated.data };
    }

    this.cache.set("judge-agent-run", body, response);
    return response;
  }

  /**
   * AAOS Overview Monitor Phase O1, Finding 4 item 2 — `GET /api/v1/overview`'s Insight Bar. Called
   * IN-PROCESS ONLY by `OverviewService.getOverview` (no HTTP endpoint of its own, same "in-process
   * only" precedent `selectTargeting`/`generateImprovementPlan` already establish), fed by that
   * SAME request's own already-computed real numbers — see `DailyInsightRequestDto`'s own doc. Same
   * cache/gate/call/validate/cache shape as every other method on this service; unlike
   * `judgeAgentRun`, this DOES resolve through `PromptOverrideService` (it is an ordinary
   * insight-generation prompt, not a judge prompt policing the self-improving loop — no circularity
   * concern applies here).
   */
  async generateDailyInsight(
    tenantId: string,
    body: DailyInsightRequestDto,
  ): Promise<DailyInsightResponseDto> {
    const cached = this.cache.get("generate-daily-insight", body) as
      DailyInsightResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemPrompt = await this.promptOverride.resolve(
      tenantId,
      SAMANTHA_AGENT,
      "generate_daily_insight",
      DAILY_INSIGHT_SYSTEM_PROMPT,
    );
    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(body) },
      ],
      jsonMode: true,
    });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const parsed = safeJsonParse(completion.value);
    const validated =
      parsed === undefined ? undefined : DailyInsightLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      return unavailable("INVALID_RESPONSE");
    }

    const response: DailyInsightResponseDto = { available: true, ...validated.data };
    this.cache.set("generate-daily-insight", body, response);
    return response;
  }

  /**
   * AAOS-CAMPAIGNS-UNIFIED-PAGE — `POST /api/v1/campaigns/insight`'s real backend
   * (`MetaAdsService.getCampaignInsight`, a thin pass-through — see that method's own doc for why
   * this genuinely needs a dedicated endpoint, unlike `assetInsight`'s in-process-only call). Same
   * cache/gate/call/validate/cache composition as every other method on this service — SAMANTHA
   * ADVANCED SPRINT 2 only deepened `body`'s real schema and `CAMPAIGN_INSIGHT_SYSTEM_PROMPT`'s own
   * text (see that constant's doc), this method's architecture is unchanged.
   */
  async campaignInsight(
    tenantId: string,
    body: CampaignInsightRequestDto,
  ): Promise<CampaignInsightResponseDto> {
    const cached = this.cache.get("campaign-insight", body) as
      CampaignInsightResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemPrompt = await this.promptOverride.resolve(
      tenantId,
      SAMANTHA_AGENT,
      "campaign_insight",
      CAMPAIGN_INSIGHT_SYSTEM_PROMPT,
    );
    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(body) },
      ],
      jsonMode: true,
    });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const parsed = safeJsonParse(completion.value);
    const validated =
      parsed === undefined ? undefined : CampaignInsightLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      logCampaignInsightValidationFailure(
        completion.value,
        validated === undefined ? "response was not valid JSON at all" : validated.error.message,
      );
      return unavailable("INVALID_RESPONSE");
    }

    const response: CampaignInsightResponseDto = { available: true, ...validated.data };
    this.cache.set("campaign-insight", body, response);
    return response;
  }

  /**
   * AAOS-SAMANTHA-LLM-AD-COPY — real, LLM-generated ad copy (originally exactly 3 variants A/B/C,
   * now up to `MAX_VARIANT_COUNT` per the bulk-publish widening — see `AdCopyVariantsRequestDto.
   * targetCount`'s own doc) for ONE PROPERTY listing, replacing (with an honest fallback — see
   * below) `PropertyCopyBuilder`'s deterministic string-template variants as the real source of a
   * `creative_packages` row's `copyVariants`. Same cache/gate/call/validate/cache shape as every
   * other method on this service — no bespoke composition.
   *
   * Real caller: `CreativePackagesService.generateProperty`. On ANY failure here (`available:
   * false`, whatever the reason), the caller's own documented, honest fallback is to build
   * `copyVariants` from the existing deterministic `PropertyCopyBuilder.buildVariants` templates
   * instead — this method itself never fabricates copy text, and never throws (same "typed
   * `available: false`, never an exception" discipline as `analyze`/`creativeBrief`/every other
   * method here).
   */
  async generateAdCopyVariants(
    tenantId: string,
    body: AdCopyVariantsRequestDto,
  ): Promise<AdCopyVariantsResponseDto> {
    const cached = this.cache.get("generate-ad-copy-variants", body) as
      AdCopyVariantsResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemPrompt = await this.promptOverride.resolve(
      tenantId,
      SAMANTHA_AGENT,
      "generate_ad_copy_variants",
      AD_COPY_VARIANTS_SYSTEM_PROMPT,
    );
    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(body) },
      ],
      jsonMode: true,
    });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const parsed = safeJsonParse(completion.value);
    const validated =
      parsed === undefined ? undefined : AdCopyVariantsLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      return unavailable("INVALID_RESPONSE");
    }

    const response: AdCopyVariantsResponseDto = { available: true, ...validated.data };
    this.cache.set("generate-ad-copy-variants", body, response);
    return response;
  }

  /**
   * Samantha Andromeda-Aware Campaign System, Sprint 2 — Kai's diverse-creative-set brief
   * generation. Same cache/gate/call/validate/cache composition as every other method on this
   * service, PLUS one extra, load-bearing step mirroring `selectTargeting`'s/`campaignStrategy`'s
   * own "never trust the LLM to only use the vocabulary/candidates it was given" discipline: every
   * returned brief whose `angle` is in the caller's real `body.existingAngles`, OR whose `angle`
   * duplicates an EARLIER brief in this same response, is DROPPED (keeping the first, in-order
   * occurrence of each real, still-unused angle) — never trusted from the prompt text alone. If
   * NOTHING survives that filter, the whole response is `INVALID_RESPONSE` (same "an empty,
   * meaningless selection is not a real success" discipline `selectTargeting` already establishes),
   * never a fabricated empty-but-`available:true` result.
   *
   * Real caller: `CreativePackagesService.createDiverseSet` — see that method's own doc for how
   * `body.targetCount`/`body.existingAngles` are honestly computed (the real remaining daily
   * auto-brief cap, and the real angles already in use on this campaign's existing
   * `creative_packages` rows) BEFORE this method is ever called, and for the honest deterministic
   * fallback used when this method returns `available: false`.
   */
  async generateDiverseCreativeBriefSet(
    tenantId: string,
    body: DiverseCreativeBriefSetRequestDto,
  ): Promise<DiverseCreativeBriefSetResponseDto> {
    const cached = this.cache.get("generate-diverse-creative-brief-set", body) as
      DiverseCreativeBriefSetResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemPrompt = await this.promptOverride.resolve(
      tenantId,
      SAMANTHA_AGENT,
      "generate_diverse_creative_brief_set",
      DIVERSE_CREATIVE_BRIEF_SET_SYSTEM_PROMPT,
    );
    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(body) },
      ],
      jsonMode: true,
    });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const parsed = safeJsonParse(completion.value);
    const validated =
      parsed === undefined ? undefined : DiverseCreativeBriefSetLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      return unavailable("INVALID_RESPONSE");
    }

    const existingAngles = new Set(body.existingAngles);
    const seenAngles = new Set<string>();
    const briefs = validated.data.briefs.filter((brief) => {
      if (existingAngles.has(brief.angle) || seenAngles.has(brief.angle)) {
        return false;
      }
      seenAngles.add(brief.angle);
      return true;
    });
    if (briefs.length === 0) {
      return unavailable("INVALID_RESPONSE");
    }

    const response: DiverseCreativeBriefSetResponseDto = {
      available: true,
      briefs: briefs.slice(0, body.targetCount),
    };
    this.cache.set("generate-diverse-creative-brief-set", body, response);
    return response;
  }

  /**
   * AAOS Samantha Professional Optimizer, Part C — real, LLM-generated ad-copy structural
   * evaluation (Hook/Clear Problem/To The Point/Soft CTA) and, for a genuinely underperforming ad,
   * a real Pain/Offer/USP diagnosis, for ONE already-live Meta ad. Same cache/gate/call/validate/
   * cache composition as every other method on this service — no bespoke composition — with ONE
   * additional, EARLIER short-circuit: when `primaryText`/`headline`/`description` are ALL
   * `undefined` (Part B's honest degrade for a creative shape this package doesn't pull text from),
   * this returns `available: false` (`reason: "NO_COPY_TEXT"`) BEFORE the cache/gate/OpenAI call —
   * there is no real copy text to hand the LLM, so calling it would only invite a hallucinated
   * analysis of text it was never given. This check is intentionally NOT cached (it's a cheap,
   * synchronous check on the request body itself, not a network result).
   */
  async diagnoseAdCopy(
    tenantId: string,
    body: DiagnoseAdCopyRequestDto,
  ): Promise<DiagnoseAdCopyResponseDto> {
    if (
      body.primaryText === undefined &&
      body.headline === undefined &&
      body.description === undefined
    ) {
      return unavailable("NO_COPY_TEXT");
    }

    const cached = this.cache.get("diagnose-ad-copy", body) as
      DiagnoseAdCopyResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemPrompt = await this.promptOverride.resolve(
      tenantId,
      SAMANTHA_AGENT,
      "diagnose_ad_copy",
      DIAGNOSE_AD_COPY_SYSTEM_PROMPT,
    );
    const completion = await this.client.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(body) },
      ],
      jsonMode: true,
    });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const parsed = safeJsonParse(completion.value);
    const validated =
      parsed === undefined ? undefined : DiagnoseAdCopyLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      return unavailable("INVALID_RESPONSE");
    }

    const response: DiagnoseAdCopyResponseDto = { available: true, ...validated.data };
    this.cache.set("diagnose-ad-copy", body, response);
    return response;
  }

  /** Shared "no API key" / "rate limited" checks (spec Sections 6 + 7). Returns `undefined` when clear to call OpenAI. */
  /**
   * Kai Creative Engine Sprint 1 — real Vision-based analysis of ONE listing photo. Same
   * cache/gate/call/validate/cache composition every other method on this service already uses,
   * through the SAME real `OpenAiClient` gateway (`gpt-4o-mini`, vision-capable) — never a second,
   * parallel LLM client (the pasted spec assumed a direct `@anthropic-ai/sdk` call, which this
   * service does not have and should not gain a second competing provider for). The photo is passed
   * as its real, already-public URL (an `image_url` content part) — no base64 download/re-encode
   * round trip like the pasted spec's `urlToBase64` needed.
   */
  async analyzePropertyPhoto(
    tenantId: string,
    body: PhotoAnalysisRequestDto,
  ): Promise<PhotoAnalysisResponseDto> {
    const cached = this.cache.get("analyze-property-photo", body) as
      PhotoAnalysisResponseDto | undefined;
    if (cached !== undefined) {
      return cached;
    }

    const gate = this.checkGate();
    if (gate !== undefined) {
      return gate;
    }

    const systemPrompt = await this.promptOverride.resolve(
      tenantId,
      SAMANTHA_AGENT,
      "analyze_property_photo",
      PHOTO_ANALYSIS_SYSTEM_PROMPT,
    );
    const userMessage: OpenAiChatMessage = {
      role: "user",
      content: [
        { type: "text", text: "Analisa foto properti ini untuk keperluan iklan Meta Ads." },
        { type: "image_url", image_url: { url: body.photoUrl } },
      ],
    };
    const completion = await this.client.createChatCompletion({
      messages: [{ role: "system", content: systemPrompt }, userMessage],
      jsonMode: true,
    });
    if (!completion.ok) {
      return unavailable("PROVIDER_ERROR");
    }

    const parsed = safeJsonParse(completion.value);
    const validated =
      parsed === undefined ? undefined : PhotoAnalysisLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      return unavailable("INVALID_RESPONSE");
    }

    const response: PhotoAnalysisResponseDto = { available: true, ...validated.data };
    this.cache.set("analyze-property-photo", body, response);
    return response;
  }

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
