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
  "generate_improvement_plan",
];

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

/**
 * AAOS Analytics Platform Phase 4, "Creative Drill-Down" — the one real LLM-generated insight
 * this phase adds (contrast Phase 3's deliberately deterministic `generateHeatmapInsight`, which
 * stays a pure template per that phase's own explicit instruction). Same static persona +
 * JSON-user-message shape every other real prompt in this file uses — the per-asset variable data
 * (`AssetInsightRequestDto`, built server-side by `MetaAdsService.getAssetDetail` from its own
 * already-computed real spend/CPL/audience-breakdown numbers) is sent as the user message.
 */
const ASSET_INSIGHT_SYSTEM_PROMPT = `Kamu adalah Samantha, AI Marketing Manager untuk dealer mobil bekas atau platform properti di Indonesia.

Kamu diberi data performa SATU aset kreatif (gambar/video) yang dipakai di beberapa iklan, dipecah per label audiens (BROAD/INTEREST/LOOKALIKE_1/RETARGETING/CUSTOM_CRM) — semua angka nyata dari Meta Ads.

Tugasmu: tulis SATU paragraf insight singkat dalam Bahasa Indonesia (2-3 kalimat) yang menyebutkan audiens mana yang paling efisien untuk aset ini (CPL terendah dengan lead nyata) dan apakah performanya di atas/di bawah rata-rata CPL portofolio, jika data itu tersedia. Jangan mengarang angka yang tidak ada di data.

Format response JSON:
{
  "summary": "satu paragraf insight dalam Bahasa Indonesia"
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
      "type": "PROMPT_UPDATE" | "CONFIG_UPDATE",
      "target": "salah satu prompt_key di atas",
      "before": "kutipan/ringkasan jujur dari prompt aktif",
      "after": "usulan teks prompt baru",
      "reason": "alasan singkat dalam Bahasa Indonesia",
      "severity": "LOW" | "MEDIUM" | "HIGH"
    }
  ]
}`;

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

  async analyze(tenantId: string, body: AnalyzeRequestDto): Promise<AnalyzeResponseDto> {
    const cached = this.cache.get("analyze", body) as AnalyzeResponseDto | undefined;
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
      "analyze",
      ANALYZE_SYSTEM_PROMPT,
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
    const validated = parsed === undefined ? undefined : AnalyzeLlmPayloadSchema.safeParse(parsed);
    if (validated === undefined || !validated.success) {
      return unavailable("INVALID_RESPONSE");
    }

    const response: AnalyzeResponseDto = { available: true, ...validated.data };
    this.cache.set("analyze", body, response);
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
   * Samantha insight. Called IN-PROCESS by `MetaAdsService.getAssetDetail`, the SAME
   * `LlmModule`-imported-not-reprovided pattern `SimulationService` already establishes for
   * `creativeBrief`/`analyze` (coordinator note precedent: "call the real thing, never
   * reimplement it"). Same cache/gate/call/validate/cache shape as every other method on this
   * service.
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
   * **Every `improvements[].target` is checked against `KNOWN_PROMPT_KEYS`, the real Phase A
   * `prompt_key` vocabulary.** Any improvement whose `target` isn't in that list is DROPPED (not
   * kept, not failing the whole response) — an LLM is not trusted to only propose a change to a
   * prompt key that actually exists, no matter what the prompt says. `droppedCount` on the
   * response tells the caller how many were dropped, so `LearningService` can document it on the
   * stored proposal row rather than silently losing the information.
   *
   * REAL FINDING: `023_agent_config_overrides.sql`'s `config_key` column is INERT (no real Kai
   * config key is wired to anything yet — see that migration's own header doc). There is therefore
   * no real `config_key` vocabulary to validate a `CONFIG_UPDATE` improvement's `target` against
   * today, so every `CONFIG_UPDATE` improvement is dropped by the same `KNOWN_PROMPT_KEYS` check
   * above (it will never match a prompt_key) — honest given the current state of the codebase,
   * never a fabricated config-key allowlist.
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

    const knownKeys = new Set(KNOWN_PROMPT_KEYS);
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
