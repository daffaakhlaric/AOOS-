/**
 * The dealer branch a campaign/adset targets, extracted by `utils/BranchExtractor.ts`.
 *
 * Judgment call: the spec's domain-model comment lists `Cinere | Bintaro | Bandung |
 * Jabodetabek | Multi | Umum`, while its Branch Extraction rules explicitly produce
 * `Branch.BOOST` for names containing "Boost"/"boost". Both are real, spec-derived
 * outcomes, so both members are kept: `BOOST` because the extraction rule requires it,
 * and `JABODETABEK` is retained as a named, reserved value for a future extraction rule
 * (no current pattern maps to it — see BranchExtractor's docstring).
 */
export enum Branch {
  CINERE = "CINERE",
  BINTARO = "BINTARO",
  BANDUNG = "BANDUNG",
  JABODETABEK = "JABODETABEK",
  BOOST = "BOOST",
  MULTI = "MULTI",
  UMUM = "UMUM",
}
