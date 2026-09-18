/**
 * PROMPT 46 — PROPERTY INTEGRITY MODES.
 *
 * Real spec text (verbatim, master spec dump, transcript line ~65407):
 *   STRICT: Secondary/resale.
 *   ENHANCE: exposure / white balance / lighting / minor cleanup / perspective.
 *   CONCEPTUAL: land / future development. Must support "ILUSTRASI" label.
 *
 * Only a 2-way split is built here, not the spec's full 3-way STRICT/ENHANCE/CONCEPTUAL split.
 * The single real, honest, controlled-vocabulary listing field that maps onto this distinction is
 * `Listing.propertyType` (`apps/aaos-api/src/modules/listings/dto/listing.dto.ts`'s
 * `PROPERTY_TYPES` — `RUMAH | APARTEMEN | RUKO | TANAH | VILLA`): `TANAH` genuinely means "land",
 * exactly the spec's own CONCEPTUAL example. There is no honest, controlled field anywhere in the
 * listing schema that distinguishes "secondary/resale" (STRICT) from "needs exposure/white-
 * balance/perspective cleanup" (ENHANCE) for a built unit — `condition`/`certificate` are free-text
 * OPTIONAL strings a manager may or may not fill in any particular vocabulary
 * (`CreateListingBodySchema`: `condition: z.string().min(1).optional()`), not a controlled enum.
 * Inventing an ENHANCE branch off that free text would mean guessing/regexing an unstructured
 * field — exactly what this phase was told not to do. So ENHANCE is not modeled until a real,
 * structured `constructionStatus`-shaped field exists on `Listing` (future-phase scope, not
 * fabricated here).
 *
 * A built-property type (`RUMAH`/`APARTEMEN`/`RUKO`/`VILLA`) maps to STRICT — an honest "this is a
 * real, existing unit" default: a listing of one of those types carries real uploaded photos of a
 * real, physically-inspectable structure, and nothing in the schema suggests otherwise. Any OTHER
 * `propertyType` value (`TANAH`, or a genuinely unrecognized/empty string — which cannot happen
 * through the validated `CreateListingBodySchema` today, but this mapper does not assume that
 * forever) degrades to CONCEPTUAL, per this phase's "never default toward the riskier assumption
 * when uncertain" discipline: an unrecognized value is genuine uncertainty, never a confirmed
 * built, ready-to-inspect unit.
 */
export enum PropertyIntegrityMode {
  STRICT = "STRICT",
  CONCEPTUAL = "CONCEPTUAL",
}

/** The listing's real, honest `propertyType` values (mirrors `PROPERTY_TYPES` minus `"TANAH"`) that genuinely mean "a built, physically-inspectable unit". Mirrored here as a literal set — this package never imports `apps/aaos-api`'s DTO (wrong dependency direction; `apps/aaos-api` depends on `@aos/creative-agent`, never the reverse). */
const BUILT_UNIT_PROPERTY_TYPES: ReadonlySet<string> = new Set([
  "RUMAH",
  "APARTEMEN",
  "RUKO",
  "VILLA",
]);

/** The disclosure label the spec's CONCEPTUAL mode must support ("Must support ILUSTRASI label"). */
export const ILUSTRASI_LABEL = "ILUSTRASI";

/**
 * Deterministic, honest mapper from a listing's real `propertyType` to its `PropertyIntegrityMode`.
 * See this file's own class doc for the full reasoning — in short: `TANAH` (land) and any
 * unrecognized value both conservatively map to `CONCEPTUAL`; the 4 known built-unit types map to
 * `STRICT`.
 */
export function decidePropertyIntegrityMode(propertyType: string): PropertyIntegrityMode {
  return BUILT_UNIT_PROPERTY_TYPES.has(propertyType)
    ? PropertyIntegrityMode.STRICT
    : PropertyIntegrityMode.CONCEPTUAL;
}
