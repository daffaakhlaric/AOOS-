import type { BranchAudienceDefault } from "./BranchAudienceDefaults.js";

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2 (spec Part 11's `PROPERTY_BRANCH_AUDIENCE`) — the
 * PROPERTY vertical's sibling to `BRANCH_AUDIENCE_DEFAULTS`. Deliberately a SEPARATE map, not an
 * extension of `Branch` (the automotive `Branch` enum's members — `CINERE`/`BINTARO`/`BANDUNG`/
 * `JABODETABEK`/`BOOST`/`MULTI`/`UMUM` — are DSS Motor's real physical showroom branches; a
 * PROPERTY tenant's branches are a different, tenant-defined set with no shared enum today, e.g.
 * `listings.branch_id` is free `TEXT`, not `Branch`). Keyed by plain uppercase branch-name
 * strings instead.
 *
 * ⚠ SAME "INITIAL DEFAULTS PENDING BUSINESS REVIEW" CAVEAT AS `BRANCH_AUDIENCE_DEFAULTS` — these
 * are a documented judgment call (spec's literal "age 27-55 per branch"), not confirmed
 * PropertyKlik targeting data. Every UI rendering these MUST show the same review warning.
 *
 * NOTE ON AGE/GENDER: per spec Part 11's "Special Ad Category: HOUSING" section, once a real
 * campaign sets `specialAdCategories: ['HOUSING']` (Meta's mandatory category for property ads —
 * see `HOUSING_SPECIAL_AD_CATEGORY` below), Meta ITSELF disables age/gender targeting — these
 * `ageMin`/`ageMax` values are therefore display-only estimates for the Simulasi preview's
 * "who this would reach absent HOUSING restrictions" framing, never sent as real `targeting.age_min`/
 * `age_max` once HOUSING is set. Real HOUSING-aware campaign payload construction is Phase 3 (Go
 * Live) scope — this file only provides the config surface that phase consumes.
 */
export const PROPERTY_BRANCH_AUDIENCE_DEFAULTS: Readonly<Record<string, BranchAudienceDefault>> = {
  BINTARO: {
    cities: ["Tangerang Selatan", "Jakarta Selatan", "Tangerang"],
    radiusKm: 25,
    ageMin: 27,
    ageMax: 55,
    note: "⚠ Perkiraan awal, perlu direview — bukan data targeting resmi PropertyKlik.",
  },
  CINERE: {
    cities: ["Depok", "Jakarta Selatan", "Tangerang Selatan"],
    radiusKm: 25,
    ageMin: 27,
    ageMax: 55,
    note: "⚠ Perkiraan awal, perlu direview — bukan data targeting resmi PropertyKlik.",
  },
  JAKARTA: {
    cities: ["Jakarta"],
    radiusKm: 30,
    ageMin: 28,
    ageMax: 55,
    note: "⚠ Perkiraan awal, perlu direview — bukan data targeting resmi PropertyKlik.",
  },
  BANDUNG: {
    cities: ["Bandung", "Cimahi"],
    radiusKm: 30,
    ageMin: 25,
    ageMax: 50,
    note: "⚠ Perkiraan awal, perlu direview — bukan data targeting resmi PropertyKlik.",
  },
  SURABAYA: {
    cities: ["Surabaya"],
    radiusKm: 30,
    ageMin: 27,
    ageMax: 55,
    note: "⚠ Perkiraan awal, perlu direview — bukan data targeting resmi PropertyKlik.",
  },
  // Unclassified fallback — nationwide, same rationale as `Branch.UMUM`'s automotive default.
  UMUM: {
    cities: ["Indonesia"],
    radiusKm: 0,
    ageMin: 25,
    ageMax: 55,
    note: "⚠ Perkiraan awal, perlu direview — bukan data targeting resmi PropertyKlik.",
  },
};

/** Looks up the PROPERTY vertical's initial audience default for a branch id, falling back to `UMUM` (nationwide) for anything unrecognized — same "unknown branch is a display concern, never a reason to fail" discipline as `branchAudienceDefault`. */
export function propertyBranchAudienceDefault(branch: string | undefined): BranchAudienceDefault {
  const key = (branch ?? "").toUpperCase();
  return PROPERTY_BRANCH_AUDIENCE_DEFAULTS[key] ?? PROPERTY_BRANCH_AUDIENCE_DEFAULTS["UMUM"]!;
}

/** Meta's mandatory `special_ad_categories` value for property/housing ads (spec Part 11). Real campaign creation wiring is Phase 3 (Go Live) scope — see this file's class doc. */
export const HOUSING_SPECIAL_AD_CATEGORY = "HOUSING" as const;

/** The exact Indonesian warning copy spec Part 11 requires wherever a PROPERTY campaign's targeting step is shown. */
export const HOUSING_POLICY_WARNING =
  "⚠ Meta Policy: iklan properti wajib pakai Special Ad Category HOUSING. Targeting usia & gender dinonaktifkan oleh Meta.";
