/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2 (spec Part 5's "Angle Kreatif" list for the
 * PROPERTY vertical's Creative Review "Buat Manual" tab).
 *
 * Deliberately a SEPARATE enum from `@aos/meta-ads-agent`'s `AdAngle`, not an extension of it:
 * `AdAngle` is closed over by roughly a dozen exhaustive `Record<AdAngle, ...>` tables across
 * `packages/meta-ads-agent` (`BusinessKnowledgeBase`, `AngleRecommender`, `CreativeBriefBuilder`,
 * `ANGLE_USP_MAP`, …) — every one of those is automotive-only domain knowledge (MAAO performance
 * history, credit/showroom copy) that has no PROPERTY equivalent yet. Adding PROPERTY members to
 * that enum would force every one of those unrelated tables to grow a fabricated PROPERTY entry
 * just to keep compiling, which is a far larger and riskier change than "add a prompt builder".
 * This vertical gets its own angle vocabulary instead — the same "don't invert an existing
 * dependency direction / don't force a shared vocabulary where it doesn't fit" reasoning
 * `BranchAudienceDefaults.ts` documents for its own package-placement choice.
 */
export enum PropertyAdAngle {
  DP_RINGAN = "DP_RINGAN",
  READY_HUNI = "READY_HUNI",
  INVESTASI = "INVESTASI",
  EXCLUSIVE = "EXCLUSIVE",
  SYARIAH = "SYARIAH",
  PROMO_TERBATAS = "PROMO_TERBATAS",
  TESTIMONIAL = "TESTIMONIAL",
  VIRTUAL_TOUR = "VIRTUAL_TOUR",
}

/** All 8 members, in the spec's declared order. */
export const ALL_PROPERTY_AD_ANGLES: readonly PropertyAdAngle[] = [
  PropertyAdAngle.DP_RINGAN,
  PropertyAdAngle.READY_HUNI,
  PropertyAdAngle.INVESTASI,
  PropertyAdAngle.EXCLUSIVE,
  PropertyAdAngle.SYARIAH,
  PropertyAdAngle.PROMO_TERBATAS,
  PropertyAdAngle.TESTIMONIAL,
  PropertyAdAngle.VIRTUAL_TOUR,
];
