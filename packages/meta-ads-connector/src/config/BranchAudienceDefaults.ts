import { Branch } from "../domain/value-objects/Branch.js";

/**
 * ⚠ INITIAL DEFAULTS PENDING BUSINESS REVIEW — NOT confirmed DSS Motor targeting data.
 *
 * Nothing in this repository has ever carried a real geo/age targeting value: verified by reading
 * the entire real Meta integration, no `targeting` field of any kind is constructed anywhere in
 * this package's campaign-creation path. The values below are therefore a documented JUDGMENT
 * CALL, derived from each branch's real physical location, and every UI that renders them MUST
 * label them as an unreviewed initial default (the Simulasi wizard shows
 * "⚠ Perkiraan awal, perlu direview"). They are display-only inputs to the Simulasi audience
 * preview — they are NOT wired into `CreateCampaign`/`CreateAdSet`, so real campaign creation
 * behaves identically with or without this file.
 *
 * WHY THIS PACKAGE (rather than `@aos/meta-ads-agent`): the `Branch` enum these defaults are keyed
 * by is defined here, and the shape they describe (city + radius in km + `age_min`/`age_max`) is a
 * Meta Ads targeting-spec shape, i.e. this package's own vocabulary. Putting it in
 * `@aos/meta-ads-agent` would have forced that package to re-derive Meta's targeting vocabulary
 * and would have inverted the existing dependency direction (the agent package consumes connector
 * types, not the other way round).
 *
 * What each field really means:
 * - `cities`: real Indonesian city/kota names near the branch's real location. Cinere is in Depok
 *   and Bintaro straddles Tangerang Selatan/South Jakarta, so both are given their surrounding
 *   Jabodetabek cities rather than a single point. Bandung is its own city.
 * - `radiusKm`: how wide around those cities to reach. A judgment call, not measured.
 * - `ageMin`/`ageMax`: 25–50 for every physical branch, matching the framing of this codebase's
 *   existing `TargetPersona.PRIMARY_FAMILY`/`SECONDARY_BUSINESS` (working-age family car buyers).
 *   Also a judgment call.
 * - `note`: the Indonesian caveat string rendered verbatim in the UI. Never omit it.
 *
 * `JABODETABEK`/`BOOST`/`MULTI`/`UMUM` are not physical branches — `BOOST` marks a boosted-post
 * campaign, `MULTI` a multi-branch one, `UMUM` an unclassified one — so they get a deliberately
 * broad default (Jabodetabek-wide, or all-Indonesia for `UMUM`) rather than a fabricated address.
 */
export interface BranchAudienceDefault {
  /** Real Indonesian city names, or `["Indonesia"]` for the nationwide fallback. */
  readonly cities: readonly string[];
  readonly radiusKm: number;
  readonly ageMin: number;
  readonly ageMax: number;
  /** Indonesian human-readable caveat — rendered verbatim so the default is never mistaken for confirmed data. */
  readonly note: string;
}

const REVIEW_NOTE = "⚠ Perkiraan awal, perlu direview — bukan data targeting resmi DSS Motor.";

const DEFAULT_AGE_MIN = 25;
const DEFAULT_AGE_MAX = 50;

export const BRANCH_AUDIENCE_DEFAULTS: Readonly<Record<Branch, BranchAudienceDefault>> = {
  // Cinere is a kecamatan of Depok, on the Depok/South Jakarta/Tangerang Selatan border.
  [Branch.CINERE]: {
    cities: ["Depok", "Jakarta Selatan", "Tangerang Selatan"],
    radiusKm: 25,
    ageMin: DEFAULT_AGE_MIN,
    ageMax: DEFAULT_AGE_MAX,
    note: REVIEW_NOTE,
  },
  // Bintaro straddles Tangerang Selatan and South Jakarta (Pesanggrahan).
  [Branch.BINTARO]: {
    cities: ["Tangerang Selatan", "Jakarta Selatan", "Tangerang"],
    radiusKm: 25,
    ageMin: DEFAULT_AGE_MIN,
    ageMax: DEFAULT_AGE_MAX,
    note: REVIEW_NOTE,
  },
  [Branch.BANDUNG]: {
    cities: ["Bandung", "Cimahi"],
    radiusKm: 30,
    ageMin: DEFAULT_AGE_MIN,
    ageMax: DEFAULT_AGE_MAX,
    note: REVIEW_NOTE,
  },
  // No single physical location — the whole Jabodetabek metro area.
  [Branch.JABODETABEK]: {
    cities: ["Jakarta", "Bogor", "Depok", "Tangerang", "Tangerang Selatan", "Bekasi"],
    radiusKm: 40,
    ageMin: DEFAULT_AGE_MIN,
    ageMax: DEFAULT_AGE_MAX,
    note: REVIEW_NOTE,
  },
  // `BOOST` marks a boosted post, not a branch — same broad Jabodetabek default.
  [Branch.BOOST]: {
    cities: ["Jakarta", "Bogor", "Depok", "Tangerang", "Tangerang Selatan", "Bekasi"],
    radiusKm: 40,
    ageMin: DEFAULT_AGE_MIN,
    ageMax: DEFAULT_AGE_MAX,
    note: REVIEW_NOTE,
  },
  // `MULTI` spans more than one branch — the union of every physical branch's metro area.
  [Branch.MULTI]: {
    cities: ["Jakarta", "Bogor", "Depok", "Tangerang", "Tangerang Selatan", "Bekasi", "Bandung"],
    radiusKm: 40,
    ageMin: DEFAULT_AGE_MIN,
    ageMax: DEFAULT_AGE_MAX,
    note: REVIEW_NOTE,
  },
  // `UMUM` is the unclassified fallback — nationwide, and a wider age band, because nothing about
  // the campaign narrows it. Guessing a city here would be a fabrication.
  [Branch.UMUM]: {
    cities: ["Indonesia"],
    radiusKm: 0,
    ageMin: 21,
    ageMax: 55,
    note: REVIEW_NOTE,
  },
};

/**
 * Looks up the initial (unreviewed) audience default for a branch. Accepts a raw string because
 * the Simulasi pipeline's stored `branch` is persisted as free text; an unrecognized value falls
 * back to `Branch.UMUM`'s nationwide default rather than throwing — an unknown branch is a display
 * concern here, never a reason to fail a simulation.
 */
export function branchAudienceDefault(branch: string | undefined): BranchAudienceDefault {
  const known = (Object.values(Branch) as string[]).includes(branch ?? "")
    ? (branch as Branch)
    : Branch.UMUM;
  return BRANCH_AUDIENCE_DEFAULTS[known];
}
