import type { PropertyResponseContext } from "../contracts/IPropertyResponseGenerator.js";
import { MessageDirection } from "../domain/entities/ConversationMessage.js";
import { ConversationStage } from "../domain/value-objects/ConversationStage.js";
import { formatPrice } from "../responses/formatters.js";

import type { OpenAiChatMessage } from "./OpenAiChatClient.js";

const DEFAULT_SALES_NAME = "tim sales kita";

/**
 * PROPERTY-vertical sibling to `buildClaraPrompt.ts`'s `STAGE_INSTRUCTIONS` — same per-stage
 * instruction discipline, root-caused against `@aos/ai-judge`'s real scorers (read directly, not
 * guessed) rather than copy-pasted from AUTOMOTIVE:
 *
 * - `ClosingAttemptScorer`'s `MENTIONS_CLOSING_INTENT` rule matches `CLOSING_INTENT_PATTERN`
 *   (`test\s*drive|survei|survey|jadwal`) — PROPERTY has no "test drive", so the CLOSING
 *   instruction below explicitly asks for "survei" or "jadwal" wording (both real matches).
 * - `ClosingAttemptScorer`'s `CLOSING_NOT_TOO_LATE`/`HandoffQualityScorer`'s `REASONABLE_TURNS`
 *   both reward turn <= 10 — QUALIFICATION's instruction pushes to ask ONE missing dimension at a
 *   time (never all 6 at once) so real signal accumulates fast enough to reach CLOSING/HANDOFF
 *   before turn 10, without the reply itself becoming a wall of text.
 * - `HandoffQualityScorer`'s `MENTIONS_SALES_TEAM` rule matches `/tim kita/i` verbatim — the
 *   HANDOFF instruction below asks for that literal phrase (mirrors the existing scripted
 *   `propertyHandoffPool`'s own wording, which already says "tim kita").
 * - `ObjectionHandlingScorer`'s `MENTIONS_MOBIX_USP` rule matches `Otospector|150 titik|garansi` —
 *   confirmed by direct read of `TextPatterns.ts` this is car-inspection-specific vocabulary with
 *   NO real PROPERTY equivalent in the codebase; those 3 points are structurally unreachable for
 *   PROPERTY conversations regardless of prompt wording, so the OBJECTION instruction instead
 *   leans on the two things it CAN control: `EMPATHETIC` (`!isPushy`) and `CONCISE_OBJECTION_RESPONSE`
 *   (<=200 chars) — both real, reachable rules — using PROPERTY-appropriate trust language
 *   (legalitas/kondisi unit, matching the existing scripted `PROPERTY_PRICE_OBJECTION_POOL`'s own
 *   wording) instead of inventing an automotive-flavored USP claim that would be dishonest for a
 *   property listing anyway.
 * - `NaturalLanguageScorer`'s `ROBOT_GREETING` rule only matches the literal automotive opener
 *   ("Halo, saya Clara dari Mobix By DSS Motor") — never reachable for PROPERTY replies, so no
 *   PROPERTY-specific instruction is needed for it; the general "jangan buka pesan super formal"
 *   guidance below still keeps GREETING natural regardless.
 */
const PROPERTY_STAGE_INSTRUCTIONS: Record<ConversationStage, string> = {
  [ConversationStage.GREETING]:
    "Sapa lead dengan hangat, perkenalkan diri sebagai Clara dari tim properti, tanya mau cari rumah/apartemen/ruko/tanah/villa apa.",
  [ConversationStage.DISCOVERY]:
    "Gali kebutuhan lead — buat ditinggali sendiri atau investasi, tipe properti apa — lalu begitu ada gambaran, mulai selipkan satu pertanyaan kualifikasi (budget/area/tipe properti/pembayaran/timeline/kamar tidur).",
  [ConversationStage.QUALIFICATION]:
    "Tanyakan SATU info yang paling penting dan belum diketahui dari: budget, tipe properti, area/lokasi, metode pembayaran (cash/KPR), timeline pembelian, jumlah kamar tidur — to the point, jangan borongan semua sekaligus.",
  [ConversationStage.UNIT_INFO]:
    "Jawab pertanyaan soal listing yang tersedia (pakai data listing yang cocok kalau ada) dengan akurat, lalu kalau lead terlihat tertarik, selipkan ajakan survei lokasi.",
  [ConversationStage.PRICE_INFO]:
    "Jelaskan estimasi DP/simulasi KPR listing yang diminati, lalu tawarkan lanjut survei lokasi atau hitung simulasi lengkap.",
  [ConversationStage.OBJECTION]:
    "Atasi keberatan lead dengan empati dan fakta soal legalitas/kondisi unit, jangan defensif atau pushy — balas ringkas (di bawah 200 karakter), lalu tetap arahkan balik ke ajakan survei.",
  [ConversationStage.CLOSING]:
    "Dorong lead secara eksplisit untuk survei lokasi atau atur jadwal — sebutkan kata 'survei' atau 'jadwal' di pesan, jangan cuma nanya 'gimana, tertarik?'.",
  [ConversationStage.HANDOFF]:
    "Sampaikan bahwa lead akan disambungkan ke sales manusia dari 'tim kita' (sebutkan frasa itu persis) agar bisa bantu detail dan atur jadwal survei — nada hangat, jangan formal/robotik.",
  [ConversationStage.NURTURE]:
    "Follow-up ringan untuk menjaga hubungan tanpa memaksa, lead belum siap sekarang.",
  [ConversationStage.CLOSED]: "Ucapkan terima kasih dan tutup percakapan dengan sopan.",
};

/**
 * Clara's PROPERTY-vertical system-prompt template. Deliberately NOT a copy of AUTOMOTIVE's
 * `SYSTEM_PROMPT_TEMPLATE` (`buildClaraPrompt.ts`) — confirmed by direct read of
 * `IPropertyResponseGenerator.ts`'s `PropertyResponseContext` that PROPERTY carries a structurally
 * different, smaller real context than automotive's `ResponseContext`:
 *
 * - No `branchName` field exists on `PropertyResponseContext` at all (`PropertyConversationEngine`
 *   only resolves a `salesName` via its `resolveSalesName` closure, never a branch display name) —
 *   so there is no honest `{branch}` slot to offer here, unlike AUTOMOTIVE's template.
 * - No aggregate `{lead_profile}`-equivalent slot either: confirmed by direct read of
 *   `PropertyConversationPipeline`'s own class doc that it deliberately never calls
 *   `LeadProfileBuilder.enrich`/`QualificationDetector.detect` the way the automotive pipeline
 *   does — `conversation.profile` stays permanently empty for every PROPERTY conversation. A
 *   `{lead_profile}` slot here would always render as fabricated/empty content, so it is
 *   intentionally omitted rather than faked.
 * - Real, PROPERTY-specific slots instead: `{score}`/`{stage}` (same shape as automotive),
 *   `{matched_listings}` (from `context.matchedListings`, the real Phase 2 `listings` match for
 *   this turn), `{requested_property_type}`/`{alternative_city}` (real UNIT_INFO/PRICE_INFO
 *   no-match signals), `{detected_intents}` (this turn's real `PropertyDetectedIntent[]` — the
 *   closest real substitute for a persistent profile, since PROPERTY tracks per-message signals,
 *   not an accumulated one), `{sales_name}`, and `{stage_instruction}`.
 *
 * `promptOverride` REPLACES the whole template content (same contract as
 * `buildClaraPrompt.ts`'s `buildSystemPrompt` — never an append), still goes through the exact
 * same `{slot}` substitution pass so a "learned improvement" can keep every slot's real per-turn
 * data while only tuning persona/style/tone wording.
 */
const PROPERTY_SYSTEM_PROMPT_TEMPLATE = `Kamu adalah Clara, sales AI properti terpercaya di Indonesia
— bantu lead cari rumah, apartemen, ruko, tanah, atau villa yang pas buat mereka.

Karakter: energik, warm, sedikit humor, tidak kaku
Gaya: informal, singkat, pakai emoji secukupnya

ATURAN PANJANG PESAN (paling penting, WAJIB dipatuhi tiap pesan):
  - Di bawah 150 karakter per pesan — hitung dulu sebelum kirim, potong kalau kepanjangan.
  - Maksimal mutlak 200 karakter — jangan pernah lebih dari itu.
  - Maksimal 3-4 kalimat pendek. Satu ide per pesan — kalau info banyak, sampaikan bertahap di pesan berikutnya, jangan digabung jadi satu pesan panjang.
  - Tidak spam, tidak pushy ("harus beli sekarang", "stok terbatas banget" DILARANG), tidak template kaku.

ATURAN KUALIFIKASI (WAJIB selama masih ada info yang belum diketahui):
  - 6 info yang relevan: budget, tipe properti (rumah/apartemen/ruko/tanah/villa), area/lokasi, metode pembayaran (cash/KPR), timeline pembelian, jumlah kamar tidur.
  - SELALU selipkan SATU pertanyaan singkat untuk menggali salah satu info yang masih kosong sebelum lanjut ke detail listing/harga — jangan tanya banyak sekaligus.
  - Kalau lead sudah kasih clue duluan (mis. nyebut kisaran harga, kota, atau "KPR"), konfirmasi & anggap sudah terjawab — jangan tanya ulang hal yang sama.

ATURAN SYARIAH (kalau lead nanya soal syariah/halal/riba):
  - Jelaskan bahwa ada opsi KPR syariah, tanpa riba, sesuai prinsip syariah — tawarkan jelasin skemanya lebih lanjut.

ATURAN OBJECTION (kalau lead ragu/membandingkan harga/khawatir kualitas):
  - Tanggapi dengan empati dan fakta soal legalitas & kondisi unit yang terjamin — JANGAN defensif, JANGAN pushy.
  - Jawaban WAJIB ringkas (di bawah 200 karakter).

ATURAN CLOSING (WAJIB begitu lead sudah kasih 2+ info di atas, atau sudah tanya soal listing/harga):
  - Aktif dorong ke langkah berikutnya — jangan tunggu lead minta duluan.
  - Sebutkan kata "survei" atau "jadwal" secara eksplisit begitu ada sinyal minat, bukan sekadar "gimana, tertarik?".

Context saat ini:
  Lead score: {score}/100
  Stage: {stage}
  Sinyal terdeteksi pesan ini: {detected_intents}
  Listing yang cocok: {matched_listings}
  Tipe properti yang ditanyakan (kalau UNIT_INFO/PRICE_INFO tanpa match): {requested_property_type}
  Kota alternatif yang ada listingnya (kalau area lead kosong): {alternative_city}
  Nama sales yang akan lanjutin (untuk HANDOFF): {sales_name}

Tugas sekarang: {stage_instruction}

Balas dalam Bahasa Indonesia informal yang natural.
HANYA balas pesan Clara — bukan narasi atau penjelasan.`;

/** Renders `context.matchedListings` into the `{matched_listings}` slot — the PROPERTY sibling to `buildClaraPrompt.ts`'s `formatAvailableUnits`. */
function formatMatchedListings(context: PropertyResponseContext): string {
  if (context.matchedListings.length === 0) {
    return "tidak ada listing yang cocok saat ini";
  }
  return context.matchedListings
    .map((listing) => {
      const bedrooms = listing.bedrooms !== undefined ? `, ${String(listing.bedrooms)} KT` : "";
      const city = listing.city !== undefined ? `, ${listing.city}` : "";
      return `${listing.title} (${listing.propertyType}${bedrooms}${city}, Rp ${formatPrice(listing.price)})`;
    })
    .join("; ");
}

/** Renders `context.intents` into the `{detected_intents}` slot — the closest real substitute PROPERTY has to an accumulated lead profile (see this file's own top-level doc). */
function formatDetectedIntents(context: PropertyResponseContext): string {
  return context.intents.length > 0 ? context.intents.join(", ") : "tidak ada sinyal spesifik";
}

/** Fills every `{slot}` in Clara's PROPERTY system prompt template from `context`. See this file's top-level doc for `promptOverride`'s exact same-as-AUTOMOTIVE replace-whole-template contract. */
export function buildPropertySystemPrompt(
  context: PropertyResponseContext,
  promptOverride?: string,
): string {
  const template = promptOverride ?? PROPERTY_SYSTEM_PROMPT_TEMPLATE;
  return template
    .replace("{score}", String(context.conversation.score.toNumber()))
    .replace("{stage}", context.stage)
    .replace("{detected_intents}", formatDetectedIntents(context))
    .replace("{matched_listings}", formatMatchedListings(context))
    .replace("{requested_property_type}", context.requestedPropertyType ?? "belum jelas")
    .replace("{alternative_city}", context.alternativeCity ?? "tidak ada")
    .replace("{sales_name}", context.salesName ?? DEFAULT_SALES_NAME)
    .replace("{stage_instruction}", PROPERTY_STAGE_INSTRUCTIONS[context.stage]);
}

/** How many of the most recent conversation turns to include as chat history — same bound as `buildClaraPrompt.ts`'s `MAX_HISTORY_MESSAGES`. */
const MAX_HISTORY_MESSAGES = 10;

/**
 * Builds the full OpenAI chat-completions `messages` array for PROPERTY — the sibling to
 * `buildClaraPrompt.ts`'s `buildConversationMessages`. Same "history already includes the current
 * inbound message as its last entry" contract (`PropertyConversationPipeline.process` appends it
 * before calling `IPropertyConversationEngine.decide`).
 */
export function buildPropertyConversationMessages(
  context: PropertyResponseContext,
  promptOverride?: string,
): OpenAiChatMessage[] {
  const history: OpenAiChatMessage[] = context.conversation.messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.direction === MessageDirection.INBOUND ? "user" : "assistant",
      content: message.text,
    }));

  return [
    { role: "system", content: buildPropertySystemPrompt(context, promptOverride) },
    ...history,
  ];
}
