import { QualificationStatus } from "../domain/value-objects/QualificationStatus.js";

export interface QualificationMatch {
  readonly status: QualificationStatus;
  readonly extractedText: string;
}

const BUDGET_PATTERN = /(\d+(?:[.,]\d+)?\s*(?:juta|jt))/i;
const UNIT_PATTERN =
  /(xpander(?:\s*\d{4})?|brio(?:\s*\d{4})?|avanza(?:\s*\d{4})?|raize(?:\s*\d{4})?|rush(?:\s*\d{4})?|stargazer(?:\s*\d{4})?)/i;
const AREA_PATTERN = /area\s+(\w+)|\b(depok|bintaro|cinere|bandung|bekasi|tangerang)\b/i;
const PAYMENT_KREDIT_PATTERN = /kredit|cicil|nyicil|angsuran/i;
const PAYMENT_CASH_PATTERN = /cash|tunai|kontan/i;
const TIMELINE_PATTERN = /(minggu ini|bulan ini|segera|sekarang)/i;
const NAME_PATTERN = /nama (?:saya|aku|gue)\s+(\w+)/i;

/**
 * Detects which of the 6 `QualificationStatus` criteria a single message text satisfies, and
 * extracts the matched fragment — the source `LeadProfileBuilder` enriches a `LeadProfile` from
 * (spec "QualificationDetector.spec.ts": `"budget 200 juta"` → BUDGET qualified, etc.).
 */
export class QualificationDetector {
  static detect(messageText: string): QualificationMatch[] {
    const matches: QualificationMatch[] = [];

    const budget = BUDGET_PATTERN.exec(messageText);
    if (budget) {
      matches.push({ status: QualificationStatus.BUDGET, extractedText: budget[1]! });
    }

    const unit = UNIT_PATTERN.exec(messageText);
    if (unit) {
      matches.push({ status: QualificationStatus.UNIT, extractedText: unit[1]! });
    }

    const area = AREA_PATTERN.exec(messageText);
    if (area) {
      matches.push({ status: QualificationStatus.AREA, extractedText: (area[1] ?? area[2])! });
    }

    if (PAYMENT_KREDIT_PATTERN.test(messageText)) {
      matches.push({ status: QualificationStatus.PAYMENT, extractedText: "Kredit" });
    } else if (PAYMENT_CASH_PATTERN.test(messageText)) {
      matches.push({ status: QualificationStatus.PAYMENT, extractedText: "Cash" });
    }

    const timeline = TIMELINE_PATTERN.exec(messageText);
    if (timeline) {
      matches.push({ status: QualificationStatus.TIMELINE, extractedText: timeline[1]! });
    }

    const name = NAME_PATTERN.exec(messageText);
    if (name) {
      matches.push({ status: QualificationStatus.NAME, extractedText: name[1]! });
    }

    return matches;
  }
}
