import type { AdInterest } from "../domain/entities/AdInterest.js";
import type { MetaAdInterest } from "../types/MetaApiTypes.js";

/**
 * Maps one (already Zod-validated) raw Meta ad-interest search row into the AAOS `AdInterest`
 * entity (AAOS-SIMULASI-TARGETING).
 *
 * Deliberately total and lossless-where-it-matters: no defaulting, no estimation, no derived
 * numbers. `audience_size_lower_bound`/`audience_size_upper_bound` are copied through exactly as
 * Meta reported them, and `topic` is simply omitted (rather than filled with a placeholder) when
 * Meta didn't supply it. `description`/`disambiguation_category` are intentionally dropped: AAOS
 * shows the name, taxonomy path and audience bounds only, and `description` is `null`/`""` on
 * every real row captured so far.
 *
 * Unlike this package's other mappers, this one returns the entity directly rather than a
 * `Result` — `AdInterest` has no value objects that can fail validation (every field is a plain
 * string/number already constrained by `MetaAdInterestSchema`), so there is no failure mode to
 * model.
 */
export function mapAdInterest(raw: MetaAdInterest, searchTerm: string): AdInterest {
  return {
    id: raw.id,
    name: raw.name,
    audienceSizeLower: raw.audience_size_lower_bound,
    audienceSizeUpper: raw.audience_size_upper_bound,
    path: raw.path,
    ...(raw.topic !== undefined ? { topic: raw.topic } : {}),
    searchTerm,
  };
}
