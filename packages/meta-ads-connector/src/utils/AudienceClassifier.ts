/**
 * `classifyAudience` — AAOS Analytics Platform Phase 2, "AI-Labeled Audiences" (design doc finding
 * #4). A small, pure, read-only classification of an ad set's Meta targeting spec into one of 5
 * display buckets: BROAD / INTEREST / LOOKALIKE_1 / RETARGETING / CUSTOM_CRM. Deliberately unrelated
 * to `packages/lookalike` (a different, write-side feature that CREATES Lookalike/Custom Audiences
 * on Meta) — this module never calls Meta, never mutates anything, only labels a targeting spec
 * that's already been read.
 *
 * ⚠ REAL, HONEST GAP (confirmed via direct read before writing this file): this package's real
 * `AdSet` domain entity (`domain/entities/AdSet.ts`) carries NO targeting field at all today —
 * `MetaApiRequestBuilder.adSetsUrl`'s real `ADSET_FIELDS` never requests Meta's `targeting` field,
 * and grepping this entire package for "targeting" turns up only the unrelated, write-side
 * `CreateCampaign`/`CreateAdSet`/`SearchAdInterests` code (none of it a *pulled* targeting spec —
 * see those files' own docstrings, which independently confirm the same "no targeting field is
 * constructed/read anywhere in this package's real pull path" finding). This function is
 * therefore REAL and independently pure/tested, but CANNOT be wired to any real pulled AdSet
 * today — doing so would require a further, separate change (requesting Meta's `targeting` field
 * on the adsets pull, plus a domain-model extension exactly like `CreativeAsset`'s addition in
 * this same phase) that is genuinely out of this phase's scope as originally sized. Flagged here
 * rather than silently worked around or fabricated from data that doesn't exist.
 *
 * `AudienceTargetingSpec` below is shaped after Meta's real, documented targeting-spec /
 * Custom-Audience vocabulary (Meta Marketing API "Targeting" and "Custom Audiences" references):
 * `custom_audiences[].subtype` is a REAL Meta enum (`CUSTOM`, `LOOKALIKE`, `WEBSITE`, `APP`,
 * `ENGAGEMENT`, `VIDEO`, `OFFLINE_CONVERSION`, ...), and `flexible_spec[].interests` is the real
 * shape `SearchAdInterests`'s own results (`domain/entities/AdInterest.ts`) would be embedded
 * under if this codebase ever built the write-side interest-targeting call the coordinator note on
 * `SearchAdInterests.ts` documents it deliberately does not yet.
 */

export type AudienceLabel = "BROAD" | "INTEREST" | "LOOKALIKE_1" | "RETARGETING" | "CUSTOM_CRM";

/** A real Meta Custom Audience `subtype` value (Meta Marketing API "Custom Audiences" reference). Only the subset this classifier distinguishes between is enumerated — Meta's real API returns others (`OFFLINE_CONVERSION`, `PARTNER`, `MANAGED`, ...) this function has no bucket for and treats as CUSTOM_CRM (an uploaded/managed list, the closest of the 5 buckets). */
export type MetaCustomAudienceSubtype =
  "CUSTOM" | "LOOKALIKE" | "WEBSITE" | "APP" | "ENGAGEMENT" | "VIDEO" | string;

export interface AudienceTargetingCustomAudience {
  readonly subtype: MetaCustomAudienceSubtype;
}

export interface AudienceTargetingInterest {
  readonly id: string;
  readonly name: string;
}

export interface AudienceTargetingFlexibleSpecEntry {
  readonly interests?: ReadonlyArray<AudienceTargetingInterest>;
}

/**
 * The subset of Meta's real `targeting` spec object this classifier reads. NOT the real `AdSet`
 * domain entity's shape (that entity carries no targeting data at all today — see this file's own
 * top-of-file gap note) — a standalone input type so this function is independently pure/testable
 * ahead of that real domain-model gap being closed.
 */
export interface AudienceTargetingSpec {
  readonly customAudiences?: ReadonlyArray<AudienceTargetingCustomAudience>;
  readonly flexibleSpec?: ReadonlyArray<AudienceTargetingFlexibleSpecEntry>;
}

/**
 * Classification order (first match wins, mirroring `FunnelClassifier`/`BranchExtractor`'s own
 * "ordered rule list, not mutually exclusive predicates" style):
 *
 *   1. Any `custom_audiences[]` entry with `subtype === "LOOKALIKE"`             → LOOKALIKE_1
 *      (this codebase's own real Lookalike-creation flow, `CreateLookalikeAudience`, only ever
 *      creates 1% lookalikes per `skills/samantha/abtesting-lookalike.md` — the 5-bucket scheme
 *      this feature specs has no separate "LOOKALIKE_2%"/"LOOKALIKE_5%" bucket, so every real
 *      Lookalike this codebase could ever attach lands in this one bucket.)
 *   2. Any `custom_audiences[]` entry with `subtype` in `{"WEBSITE","APP","ENGAGEMENT","VIDEO"}`
 *      → RETARGETING (Meta's own real behavioral-audience subtypes — website/app visitors,
 *      page/post engagers, video viewers — all genuinely "people who already interacted", the
 *      real definition of retargeting).
 *   3. Any OTHER `custom_audiences[]` entry (real Meta subtype `CUSTOM`, or any subtype this
 *      classifier doesn't otherwise recognize, e.g. `OFFLINE_CONVERSION`)                → CUSTOM_CRM
 *      (this codebase's own `CreateCustomAudience`/`AddUsersToCustomAudience` — AAOS-ABTESTING-
 *      LOOKALIKE Part 2 — creates exactly `subtype: "CUSTOM"` audiences from SHA256-hashed phone
 *      numbers, i.e. an uploaded CRM contact list; that real, existing write-side behavior is the
 *      grounding for this bucket's name).
 *   4. Any `flexible_spec[].interests` entry present (no custom audience at all)  → INTEREST
 *   5. Otherwise (no custom audience, no interest)                                → BROAD
 */
export function classifyAudience(targeting: AudienceTargetingSpec | undefined): AudienceLabel {
  const customAudiences = targeting?.customAudiences ?? [];

  if (customAudiences.some((ca) => ca.subtype === "LOOKALIKE")) {
    return "LOOKALIKE_1";
  }

  const RETARGETING_SUBTYPES: ReadonlySet<string> = new Set([
    "WEBSITE",
    "APP",
    "ENGAGEMENT",
    "VIDEO",
  ]);
  if (customAudiences.some((ca) => RETARGETING_SUBTYPES.has(ca.subtype))) {
    return "RETARGETING";
  }

  if (customAudiences.length > 0) {
    return "CUSTOM_CRM";
  }

  const hasInterest = (targeting?.flexibleSpec ?? []).some(
    (entry) => (entry.interests?.length ?? 0) > 0,
  );
  if (hasInterest) {
    return "INTEREST";
  }

  return "BROAD";
}
