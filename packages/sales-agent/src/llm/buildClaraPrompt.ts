import type { ResponseContext } from "../contracts/IResponseGenerator.js";
import { MessageDirection } from "../domain/entities/ConversationMessage.js";
import { ConversationStage } from "../domain/value-objects/ConversationStage.js";

import type { OpenAiChatMessage } from "./OpenAiChatClient.js";

/** Per-stage instruction plugged into the `{stage_instruction}` slot of the system prompt (spec's verbatim template). */
const STAGE_INSTRUCTIONS: Record<ConversationStage, string> = {
  [ConversationStage.GREETING]: "Sapa lead dengan hangat dan perkenalkan diri sebagai Clara.",
  [ConversationStage.DISCOVERY]:
    "Gali kebutuhan lead — mobil apa yang dicari, buat siapa — lalu begitu ada gambaran unitnya, mulai selipkan satu pertanyaan kualifikasi (budget/area/pembayaran).",
  [ConversationStage.QUALIFICATION]:
    "Tanyakan SATU info yang paling penting dan belum diketahui dari: budget, unit yang diminati, area/lokasi, metode pembayaran — to the point, jangan borongan semua sekaligus.",
  [ConversationStage.UNIT_INFO]:
    "Jawab pertanyaan soal unit yang tersedia dengan info yang akurat, lalu kalau lead terlihat tertarik, selipkan ajakan test drive atau survei.",
  [ConversationStage.PRICE_INFO]:
    "Jelaskan estimasi DP/cicilan unit yang diminati, lalu tawarkan lanjut test drive atau survei unit.",
  [ConversationStage.OBJECTION]:
    "Atasi keberatan lead dengan empati dan fakta, jangan defensif — setelah keberatan terjawab, tetap arahkan balik ke ajakan test drive/survei.",
  [ConversationStage.CLOSING]:
    "Dorong lead secara eksplisit untuk test drive, survei unit, atau atur jadwal ketemu — sebutkan salah satu kata itu di pesan, jangan cuma nanya 'gimana, tertarik?'.",
  [ConversationStage.HANDOFF]: "Sampaikan bahwa lead akan dilanjutkan oleh sales manusia.",
  [ConversationStage.NURTURE]: "Follow-up ringan untuk menjaga hubungan tanpa memaksa.",
  [ConversationStage.CLOSED]: "Ucapkan terima kasih dan tutup percakapan dengan sopan.",
};

const SYSTEM_PROMPT_TEMPLATE = `Kamu adalah Clara, sales AI untuk Mobix by DSS Motor
— dealer mobil bekas terpercaya di Indonesia.

Karakter: energik, warm, sedikit humor, tidak kaku
Gaya: informal, singkat, pakai emoji secukupnya

ATURAN PANJANG PESAN (paling penting, WAJIB dipatuhi tiap pesan):
  - Di bawah 150 karakter per pesan — hitung dulu sebelum kirim, potong kalau kepanjangan.
  - Maksimal 3-4 kalimat pendek. Satu ide per pesan — kalau info banyak, sampaikan bertahap di pesan berikutnya, jangan digabung jadi satu pesan panjang.
  - Tidak spam, tidak pushy, tidak template kaku.

ATURAN KUALIFIKASI (WAJIB selama masih ada info yang belum diketahui):
  - 4 info wajib digali: budget, unit yang diminati, area/lokasi, metode pembayaran (cash/kredit).
  - Selama salah satu dari 4 info itu BELUM ada di "Info yang sudah diketahui" di bawah, SELALU selipkan SATU pertanyaan singkat untuk menggali salah satunya sebelum lanjut ke info unit/harga.
  - Kalau lead sudah kasih clue duluan (mis. nyebut kisaran harga atau kota), konfirmasi & anggap sudah terjawab — jangan tanya ulang hal yang sama.

ATURAN CLOSING (WAJIB begitu lead sudah kasih 2+ dari 4 info di atas, atau sudah tanya soal unit/harga):
  - Aktif dorong ke langkah berikutnya — jangan tunggu lead minta duluan.
  - Sebutkan kata "test drive", "survei", atau "jadwal" secara eksplisit begitu ada sinyal minat, bukan sekadar "gimana, tertarik?".

Context saat ini:
  Branch: {branch}
  Lead score: {score}/100
  Stage: {stage}
  Info yang sudah diketahui: {lead_profile}
  Unit tersedia: {available_units}

Tugas sekarang: {stage_instruction}

Balas dalam Bahasa Indonesia informal yang natural.
HANYA balas pesan Clara — bukan narasi atau penjelasan.`;

/** Renders `context.conversation.profile`'s known fields into the `{lead_profile}` slot, e.g. `"budget: 200 juta, area: Cinere"`. */
function formatLeadProfile(context: ResponseContext): string {
  const { profile } = context.conversation;
  const parts: string[] = [];
  if (profile.budget !== undefined) {
    parts.push(`budget: ${profile.budget}`);
  }
  if (profile.unit !== undefined) {
    parts.push(`unit diminati: ${profile.unit}`);
  }
  if (profile.area !== undefined) {
    parts.push(`area: ${profile.area}`);
  }
  if (profile.paymentMethod !== undefined) {
    parts.push(`payment: ${profile.paymentMethod}`);
  }
  return parts.length > 0 ? parts.join(", ") : "belum ada info";
}

/** Renders `context.matchedUnits` into the `{available_units}` slot as a comma-separated list of display names. */
function formatAvailableUnits(context: ResponseContext): string {
  if (context.matchedUnits.length === 0) {
    return "tidak ada unit yang cocok saat ini";
  }
  return context.matchedUnits.map((unit) => unit.displayName).join(", ");
}

/**
 * Fills every `{slot}` in Clara's system prompt template from `context`.
 *
 * `promptOverride` (AAOS Self-Learning AI Phase A — DB-backed prompt/config override layer):
 * optional, defaults to `undefined` (no override — the spec's verbatim `SYSTEM_PROMPT_TEMPLATE` is
 * used, unchanged from before this parameter existed). When provided, it REPLACES
 * `SYSTEM_PROMPT_TEMPLATE` as the template content, but still goes through the EXACT SAME
 * `{slot}` substitution pass below — never used as fully-resolved literal content. Reasoning: every
 * `{slot}` here carries real, per-conversation data (`{branch}`/`{score}`/`{stage}`/
 * `{lead_profile}`/`{available_units}`/`{stage_instruction}`) that Clara's replies genuinely depend
 * on — a "learned improvement" from Self-Learning AI is expected to tune PERSONA/STYLE/TONE wording
 * (the spec's own worked example), not to discard the conversation's real context. `.replace(...)`
 * is a safe no-op for any slot an override happens not to mention, so an override is never required
 * to repeat every placeholder — only the ones it wants to keep dynamic.
 *
 * This package stays a plain, DI-free composition (constructor-injected interfaces / plain
 * functions, matching how `ClaraAgentFactory.createResponseGenerator` already composes
 * `LlmResponseGenerator`/`OpenAiChatClient` — no NestJS dependency here). The real DB lookup
 * (an aaos-api `PromptOverrideService`-equivalent call) is deliberately NOT wired in from this
 * package: `ClaraAgentFactory` (this package's real composition root) is invoked ONLY from
 * `apps/aaos-simulator` (via `packages/conversation-simulator`'s `ClaraSimulationComposer`) in this
 * codebase today — confirmed by direct search, `apps/aaos-api` never composes `ClaraAgentFactory`
 * (see `apps/aaos-api/src/modules/intelligence/intelligence.service.ts`'s own class doc, which
 * documents this exact finding for the AUTOMOTIVE-inventory gap). There is no real aaos-api call
 * site to thread a live override lookup into yet, so this parameter exists as real, additive
 * capability with a passing default of `undefined` (no lookup) — ready for Phase C (a later,
 * separate effort) to call into once a real caller exists, without fabricating one now.
 */
export function buildSystemPrompt(context: ResponseContext, promptOverride?: string): string {
  const template = promptOverride ?? SYSTEM_PROMPT_TEMPLATE;
  return template
    .replace("{branch}", context.branchName)
    .replace("{score}", String(context.conversation.score.toNumber()))
    .replace("{stage}", context.stage)
    .replace("{lead_profile}", formatLeadProfile(context))
    .replace("{available_units}", formatAvailableUnits(context))
    .replace("{stage_instruction}", STAGE_INSTRUCTIONS[context.stage]);
}

/** How many of the most recent conversation turns to include as chat history — bounds prompt size/cost for long-running conversations. */
const MAX_HISTORY_MESSAGES = 10;

/**
 * Builds the full OpenAI chat-completions `messages` array: the system prompt, followed by the
 * conversation history (`context.conversation.messages` already includes the current inbound
 * message as its last entry — `ConversationPipeline` appends it before calling
 * `IConversationEngine.decide` — so it is not duplicated here).
 *
 * `promptOverride` — see `buildSystemPrompt`'s own doc (AAOS Self-Learning AI Phase A); threaded
 * straight through, same `undefined`-by-default, no-real-caller-yet reasoning. The real
 * `agent_prompt_overrides.prompt_key` this would resolve against (once a real caller exists) is
 * `'clara_system_prompt'`, matching `022_agent_prompt_overrides.sql`'s worked example.
 */
export function buildConversationMessages(
  context: ResponseContext,
  promptOverride?: string,
): OpenAiChatMessage[] {
  const history: OpenAiChatMessage[] = context.conversation.messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.direction === MessageDirection.INBOUND ? "user" : "assistant",
      content: message.text,
    }));

  return [{ role: "system", content: buildSystemPrompt(context, promptOverride) }, ...history];
}
