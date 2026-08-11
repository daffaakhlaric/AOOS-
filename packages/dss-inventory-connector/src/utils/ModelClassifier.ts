import type { UnitTransmission } from "../domain/value-objects/UnitTransmission.js";

/** The parsed pieces of a free-text model string, e.g. "Xpander Cross AT 2019". */
export interface ClassifiedModel {
  readonly model: string;
  readonly variant?: string;
  readonly year?: number;
  readonly transmission?: UnitTransmission;
}

const TRANSMISSION_PATTERN = /\b(AT|MT)\b/i;
const YEAR_PATTERN = /\b(19|20)\d{2}\b/;

/**
 * Parses a single free-text model string (as a Google Sheets "Model" column might contain, per
 * `docs/ADAPTER-IMPLEMENTATION-GUIDE.md`) into `{ model, variant?, year?, transmission? }`.
 *
 * Extraction rule: find a whole-word `AT`/`MT` token (case-insensitive) as the transmission, find
 * a trailing 4-digit year token, remove both from the string, and treat everything left over
 * (trimmed, collapsed whitespace) as the model name. `variant` is not separately derived by this
 * classifier — the spec's own two worked examples ("Xpander Cross AT" → `{ model: "Xpander
 * Cross", transmission: "AT" }` and "Avanza Veloz MT 2019" → `{ model: "Avanza Veloz",
 * transmission: "MT", year: 2019 }") never populate it either, so `variant` stays `undefined`
 * until a real sheet/DMS format demonstrates a concrete separation rule.
 */
export function classifyModel(raw: string): ClassifiedModel {
  let working = raw.trim();

  let transmission: UnitTransmission | undefined;
  const transmissionMatch = TRANSMISSION_PATTERN.exec(working);
  if (transmissionMatch) {
    transmission = transmissionMatch[1]?.toUpperCase() as UnitTransmission;
    working = (
      working.slice(0, transmissionMatch.index) +
      working.slice(transmissionMatch.index + transmissionMatch[0].length)
    ).trim();
  }

  let year: number | undefined;
  const yearMatch = YEAR_PATTERN.exec(working);
  if (yearMatch) {
    year = Number.parseInt(yearMatch[0], 10);
    working = (
      working.slice(0, yearMatch.index) + working.slice(yearMatch.index + yearMatch[0].length)
    ).trim();
  }

  const model = working.replace(/\s+/g, " ").trim();

  return {
    model,
    ...(year !== undefined ? { year } : {}),
    ...(transmission !== undefined ? { transmission } : {}),
  };
}
