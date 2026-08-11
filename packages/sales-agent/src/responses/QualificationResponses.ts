import type { LeadConversation } from "../domain/entities/LeadConversation.js";
import { QualificationStatus } from "../domain/value-objects/QualificationStatus.js";

import { pickFromPool } from "./PoolSelector.js";

/**
 * Active-qualification ask pools (AAOS-W3D Fix 3) — one per core criterion
 * (`ai-judge`'s `QualificationScorer` only awards points for BUDGET/UNIT/AREA/PAYMENT being
 * extracted; TIMELINE/NAME are bonus-only). Every entry ≤ 150 chars.
 */
export const ASK_BUDGET_POOL: ReadonlyArray<string> = [
  "Budget-nya kira-kira berapa kak? Biar Jessy cariin yang paling pas 😊",
  "Range budget kak sekitar berapa ya?",
  "Mau Jessy bantu cariin, budget yang disiapkan sekitar berapa kak? 😊",
];

export const ASK_UNIT_POOL: ReadonlyArray<string> = [
  "Lagi cari model apa kak? Atau mau Jessy kasih rekomendasi? 😊",
  "Ada unit tertentu yang diincer kak?",
  "Kira-kira cari MPV, SUV, atau city car kak? 😊",
];

export const ASK_AREA_POOL: ReadonlyArray<string> = [
  "Kakak di area mana? Biar Jessy cek stok cabang terdekat 😊",
  "Domisili kak di mana ya? Biar Jessy carikan cabang terdekat",
];

export const ASK_PAYMENT_POOL: ReadonlyArray<string> = [
  "Rencananya cash atau kredit kak? 😊",
  "Mau tunai atau cicil kak?",
];

/**
 * The 4 core criteria `QualificationScorer` scores, in the spec's declared ask order — deliberately
 * a narrower list than `ALL_QUALIFICATION_STATUSES` (which also has bonus-only TIMELINE/NAME that
 * Jessy never actively interrogates for; those stay purely passive/volunteered, same as before this
 * fix).
 */
const CORE_CRITERIA: ReadonlyArray<QualificationStatus> = [
  QualificationStatus.BUDGET,
  QualificationStatus.UNIT,
  QualificationStatus.AREA,
  QualificationStatus.PAYMENT,
];

/**
 * The next core criterion Jessy should actively ask about, or `undefined` if every one has already
 * been extracted (`conversation.profile.isQualified`) or already asked (`conversation.askedCriteria`)
 * — asks exactly one at a time, in `CORE_CRITERIA` order, and never repeats a criterion already
 * asked (AAOS-W3D Fix 3's pinned behaviour). Deliberately a pure function of `conversation` alone so
 * `ConversationPipeline` can call it a second time (after `generate()` already used it to pick the
 * response text) to update `askedCriteria` immutably, and always get the identical answer.
 */
export function nextCriterionToAsk(
  conversation: LeadConversation,
): QualificationStatus | undefined {
  return CORE_CRITERIA.find(
    (criterion) =>
      !conversation.profile.isQualified(criterion) && !conversation.askedCriteria.has(criterion),
  );
}

export class QualificationResponses {
  static askFor(criterion: QualificationStatus, seed: number): string {
    switch (criterion) {
      case QualificationStatus.BUDGET:
        return pickFromPool(ASK_BUDGET_POOL, seed);
      case QualificationStatus.UNIT:
        return pickFromPool(ASK_UNIT_POOL, seed);
      case QualificationStatus.AREA:
        return pickFromPool(ASK_AREA_POOL, seed);
      case QualificationStatus.PAYMENT:
        return pickFromPool(ASK_PAYMENT_POOL, seed);
      /* v8 ignore next 2 -- `nextCriterionToAsk` only ever returns a `CORE_CRITERIA` member
         (BUDGET/UNIT/AREA/PAYMENT), so `askFor` is never actually called with TIMELINE/NAME in
         production; this default exists only so the switch is exhaustive over the full enum. */
      default:
        return pickFromPool(ASK_BUDGET_POOL, seed);
    }
  }
}
