import {
  ConceptFamilyToLayoutFamilyMapper,
  PropertyAngleToConceptFamilyMapper,
} from "@aos/creative-agent";
import type { ConceptFamily, LayoutFamily, PropertyAdAngle } from "@aos/creative-agent";

/**
 * EYVRA Samantha V2 + Kai V2 Phase 44 — PROMPT 45 (Creative Diversity Engine).
 *
 * Real spec text (verbatim, master spec dump, transcript line ~65407):
 *   Score:
 *     angle diversity
 *     concept family diversity
 *     composition diversity
 *     hero asset diversity
 *     format diversity
 *     storytelling diversity
 *     visual hook diversity
 *     information density diversity
 *   Prevent: 8 creatives, same facade, same layout, different headline.
 *
 * Phase 27's audit correctly flagged this PARTIAL/blocked: the only real diversity mechanism before
 * this phase was `LlmService.generateDiverseCreativeBriefSet`'s own angle-uniqueness filter
 * (dedupes against `existingAngles` + in-response duplicates) — real, but angle-only, so it does
 * NOT catch the spec's own named failure mode: two BRIEFS with two DIFFERENT angles can still
 * resolve to the same visual treatment ("same facade, same layout, different headline") because
 * `PropertyAngleToConceptFamilyMapper.familiesFor` (Phase 34) legitimately maps more than one angle
 * onto OVERLAPPING `ConceptFamily` members — verified directly against the real mapping table:
 *   - `DP_RINGAN` [PRICE_DOMINANT, MORTGAGE_CARD] overlaps `SYARIAH` [MORTGAGE_CARD, FAMILY_LIFESTYLE] on MORTGAGE_CARD.
 *   - `DP_RINGAN` overlaps `PROMO_TERBATAS` [SCARCITY_DIRECT, PRICE_DOMINANT] on PRICE_DOMINANT.
 *   - `READY_HUNI` [PROPERTY_FEATURE, POV_TOUR] overlaps `VIRTUAL_TOUR` [POV_TOUR, CAROUSEL_DISCOVERY] on POV_TOUR.
 *
 * HONEST COVERAGE — 4 of the spec's 8 named dimensions have real, structured backing data in this
 * codebase TODAY and are scored below; the other 4 do not and are NOT fabricated:
 *   - "angle diversity"            COVERED — `DiverseCreativeBriefLlmSchema.angle` (real `PropertyAdAngle`, 8 members, already used by every consumer of this brief shape).
 *   - "concept family diversity"   COVERED — Phase 34's `PropertyAngleToConceptFamilyMapper.familiesFor(angle)`, deterministic.
 *   - "composition diversity"      COVERED — Phase 37's `ConceptFamilyToLayoutFamilyMapper.layoutFor(conceptFamily)`, deterministic (the spec's own "layout" is this codebase's real `LayoutFamily` taxonomy).
 *   - "format diversity"           COVERED — `DiverseCreativeBriefLlmSchema.format` (real `CreativeFormat`, `VIDEO_AND_IMAGES` | `IMAGES_ONLY`).
 *   - "hero asset diversity"       OUT OF SCOPE — a brief at THIS stage (pre-generation) never selects or references a specific listing photo/asset; asset selection happens later, downstream of brief creation, and is not captured on the brief itself anywhere in this schema.
 *   - "storytelling diversity"     OUT OF SCOPE — no structured field anywhere captures a brief's narrative arc/structure; only free-text `primaryText`/`description`, which this phase does not attempt to classify (would require fabricating a taxonomy with no real backing).
 *   - "visual hook diversity"      OUT OF SCOPE — same reason as storytelling: no structured "hook type" field exists on a brief.
 *   - "information density diversity" OUT OF SCOPE — no structured density/complexity field exists on a brief, `ConceptFamily`, or `LayoutFamily`.
 * A future phase could honestly extend this to the other 4 dimensions ONLY once real structured data
 * for them exists (e.g. an asset-selection step that records which real photo id was used, a
 * storytelling/hook taxonomy analogous to `ConceptFamily`) — inventing scores for them now would be
 * exactly the "fabricated precision" this whole session's discipline avoids.
 *
 * TWO REAL, DELIBERATELY DIFFERENT USES OF THE SAME MAPPERS BELOW:
 *   1. `scoreCreativeDiversitySet`'s per-dimension SCALAR score (`conceptFamily`/`composition`
 *      dimensions) resolves each brief to exactly ONE representative facade — the FIRST entry in
 *      `familiesFor`'s own returned array — because a distinct-count ratio needs one value per
 *      brief. This is a lightweight summary, not the safety-critical check.
 *   2. `dedupeFacadeCollisions`/`findFacadeCollisions` (the REAL, safety-critical check this phase
 *      exists to add) uses the FULL plausible-family SET per brief, not a single pick: two briefs
 *      collide when ANY of their honestly-plausible (concept-family, layout-family) pairs match —
 *      verified above against the real mapping table to actually fire on genuine angle pairs, unlike
 *      a single-pick strategy (checked: picking only `familiesFor(angle)[0]` for all 8 real angles
 *      happens to already be pairwise-distinct across the whole real vocabulary, which would make a
 *      single-pick collision check a permanent no-op — an honest miss this phase does not want to
 *      ship). Erring toward flagging a PLAUSIBLE collision (not only a certain one) is the
 *      conservative direction for a diversity guardrail — the same "when uncertain, be MORE
 *      conservative, never less" discipline this session's `decideCreativeBriefGuardrail` etc.
 *      already establish elsewhere.
 */

/** The minimal real shape this scorer needs from a brief — deliberately structural, not a dependency on any specific brief DTO. */
export interface DiversityScoredBrief {
  readonly angle: string;
  readonly format: string;
}

export type CoveredDiversityDimension = "angle" | "conceptFamily" | "composition" | "format";

/** The spec's own 4 named dimensions this file does NOT score, with the honest reason why (no real structured data backs them yet). */
export const OUT_OF_SCOPE_DIVERSITY_DIMENSIONS: readonly {
  readonly dimension: string;
  readonly reason: string;
}[] = [
  {
    dimension: "hero asset diversity",
    reason:
      "A brief at this stage does not select or reference a specific listing photo/asset — asset selection happens downstream of brief creation.",
  },
  {
    dimension: "storytelling diversity",
    reason:
      "No structured field captures a brief's narrative arc/structure — only free-text primaryText/description, which this phase does not classify.",
  },
  {
    dimension: "visual hook diversity",
    reason:
      "No structured 'hook type' field exists on a brief anywhere in this codebase's data model.",
  },
  {
    dimension: "information density diversity",
    reason:
      "No structured density/complexity field exists on a brief, ConceptFamily, or LayoutFamily.",
  },
];

export interface DiversityDimensionScore {
  readonly dimension: CoveredDiversityDimension;
  /** Count of distinct real values observed for this dimension across the set. */
  readonly distinctCount: number;
  readonly totalCount: number;
  /** `distinctCount / totalCount`, `1` for an empty set (vacuously fully diverse — nothing to repeat). */
  readonly score: number;
}

/** One real, honestly-PLAUSIBLE "same facade, same layout" collision — `>= 2` briefs whose real, plausible (concept-family, layout-family) sets share at least one common pair, even though their real angles may differ. Not a claim that both briefs would DEFINITELY render identically (Kai has not chosen a single concept family per brief yet, see this file's own header doc) — a real, conservative flag that they honestly COULD. */
export interface FacadeCollisionGroup {
  readonly conceptFamily: ConceptFamily;
  readonly layoutFamily: LayoutFamily;
  /** Index into the original input array for every brief whose plausible facade set includes this pair (declaration order preserved). */
  readonly indices: readonly number[];
  /** The real angle of every brief in `indices` — proof this is NOT merely angle repetition (angles here may all differ). */
  readonly angles: readonly string[];
}

export interface DiversitySetScore {
  readonly dimensions: readonly DiversityDimensionScore[];
  /** Mean of every dimension's `score`, `1` for an empty set. */
  readonly overallScore: number;
  /** Every real, plausible facade collision found — empty when the set is honestly free of the "same facade, same layout, different headline" failure mode. */
  readonly facadeCollisions: readonly FacadeCollisionGroup[];
  readonly coveredDimensions: readonly CoveredDiversityDimension[];
  readonly outOfScopeDimensions: typeof OUT_OF_SCOPE_DIVERSITY_DIMENSIONS;
}

interface FacadePair {
  readonly conceptFamily: ConceptFamily;
  readonly layoutFamily: LayoutFamily;
}

function facadePairKey(pair: FacadePair): string {
  return `${pair.conceptFamily}::${pair.layoutFamily}`;
}

/** Every real, honestly-plausible (concept-family, layout-family) pair for a real `PropertyAdAngle` — the FULL set `PropertyAngleToConceptFamilyMapper.familiesFor` returns (1-2 members), each resolved to its one real `LayoutFamily` via `ConceptFamilyToLayoutFamilyMapper`. Used by the collision detector; see this file's own header doc for why a full set, not a single pick. */
export function resolvePlausibleFacades(angle: string): readonly FacadePair[] {
  const families = PropertyAngleToConceptFamilyMapper.familiesFor(angle as PropertyAdAngle);
  if (families === undefined || families.length === 0) {
    /* v8 ignore next 3 */
    // Invariant: `PropertyAngleToConceptFamilyMapper.familiesFor` always returns a non-empty array
    // for every real `PropertyAdAngle` member (see that mapper's own doc + exhaustive `Record`).
    throw new Error(`resolvePlausibleFacades: no concept family mapped for angle "${angle}".`);
  }
  return families.map((conceptFamily) => ({
    conceptFamily,
    layoutFamily: ConceptFamilyToLayoutFamilyMapper.layoutFor(conceptFamily),
  }));
}

/** Deterministic, single-representative `angle` -> `ConceptFamily` resolution used ONLY for the scalar per-dimension score (`scoreCreativeDiversitySet`'s "conceptFamily"/"composition" dimensions) — the FIRST entry of `resolvePlausibleFacades`. See this file's own header doc for why the collision detector below deliberately does NOT use this narrower, single-pick resolution. */
export function resolveScoringConceptFamily(angle: string): ConceptFamily {
  const [first] = resolvePlausibleFacades(angle);
  /* v8 ignore next 3 */
  if (first === undefined) {
    throw new Error(`resolveScoringConceptFamily: no concept family mapped for angle "${angle}".`);
  }
  return first.conceptFamily;
}

/** Deterministic, single-representative `angle` -> facade resolution, the scalar counterpart of `resolvePlausibleFacades` — see `resolveScoringConceptFamily`'s own doc. */
export function resolveScoringFacade(angle: string): FacadePair {
  const conceptFamily = resolveScoringConceptFamily(angle);
  return {
    conceptFamily,
    layoutFamily: ConceptFamilyToLayoutFamilyMapper.layoutFor(conceptFamily),
  };
}

function dimensionScore(
  dimension: CoveredDiversityDimension,
  values: readonly string[],
): DiversityDimensionScore {
  const totalCount = values.length;
  const distinctCount = new Set(values).size;
  return {
    dimension,
    distinctCount,
    totalCount,
    score: totalCount === 0 ? 1 : distinctCount / totalCount,
  };
}

const COVERED_DIVERSITY_DIMENSIONS: readonly CoveredDiversityDimension[] = [
  "angle",
  "conceptFamily",
  "composition",
  "format",
];

/**
 * Every real, plausible facade collision in a brief set — `>= 2` briefs whose plausible
 * (concept-family, layout-family) sets (`resolvePlausibleFacades`) share at least one common pair.
 * Pure, synchronous, no I/O, no randomness. Used by both `scoreCreativeDiversitySet` (reporting) and
 * `dedupeFacadeCollisions` (the real, additive guardrail — see that function's own doc).
 */
export function findFacadeCollisions(
  briefs: readonly DiversityScoredBrief[],
): readonly FacadeCollisionGroup[] {
  const byFacadeKey = new Map<
    string,
    {
      conceptFamily: ConceptFamily;
      layoutFamily: LayoutFamily;
      indices: number[];
      angles: string[];
    }
  >();
  briefs.forEach((brief, index) => {
    for (const pair of resolvePlausibleFacades(brief.angle)) {
      const key = facadePairKey(pair);
      const existing = byFacadeKey.get(key);
      if (existing !== undefined) {
        existing.indices.push(index);
        existing.angles.push(brief.angle);
      } else {
        byFacadeKey.set(key, {
          conceptFamily: pair.conceptFamily,
          layoutFamily: pair.layoutFamily,
          indices: [index],
          angles: [brief.angle],
        });
      }
    }
  });
  return [...byFacadeKey.values()].filter((group) => group.indices.length > 1);
}

/**
 * Scores a candidate/finished creative-brief set across the 4 spec dimensions this codebase has
 * real, structured data for (see this file's own header doc for the honest 4/8 split). Pure,
 * synchronous, no I/O, no randomness — mirrors `scoreCreativeDiversity` (`@aos/meta-ads-connector`,
 * Andromeda Sprint 1)'s own "pure scoring function over already-resolved real inputs" shape.
 */
export function scoreCreativeDiversitySet(
  briefs: readonly DiversityScoredBrief[],
): DiversitySetScore {
  if (briefs.length === 0) {
    return {
      dimensions: COVERED_DIVERSITY_DIMENSIONS.map((dimension) => dimensionScore(dimension, [])),
      overallScore: 1,
      facadeCollisions: [],
      coveredDimensions: COVERED_DIVERSITY_DIMENSIONS,
      outOfScopeDimensions: OUT_OF_SCOPE_DIVERSITY_DIMENSIONS,
    };
  }

  const scoringFacades = briefs.map((brief) => resolveScoringFacade(brief.angle));

  const dimensions: readonly DiversityDimensionScore[] = [
    dimensionScore(
      "angle",
      briefs.map((brief) => brief.angle),
    ),
    dimensionScore(
      "conceptFamily",
      scoringFacades.map((facade) => facade.conceptFamily),
    ),
    dimensionScore(
      "composition",
      scoringFacades.map((facade) => facade.layoutFamily),
    ),
    dimensionScore(
      "format",
      briefs.map((brief) => brief.format),
    ),
  ];
  const overallScore = dimensions.reduce((sum, dim) => sum + dim.score, 0) / dimensions.length;

  return {
    dimensions,
    overallScore,
    facadeCollisions: findFacadeCollisions(briefs),
    coveredDimensions: COVERED_DIVERSITY_DIMENSIONS,
    outOfScopeDimensions: OUT_OF_SCOPE_DIVERSITY_DIMENSIONS,
  };
}

/**
 * Additive, STRICTLY MORE CONSERVATIVE filter — the real, narrow fix for the spec's own named
 * failure mode ("8 creatives, same facade, same layout, different headline") that pure
 * angle-uniqueness (the existing real `LlmService.generateDiverseCreativeBriefSet` /
 * `deterministicDiverseBriefFallback` guarantee) does not catch. Given an ordered list of briefs
 * (already angle-unique by the time either real caller produces them), drops any brief whose
 * plausible facade set (`resolvePlausibleFacades`) shares ANY (concept-family, layout-family) pair
 * with an EARLIER-kept brief's plausible facade set — keeps the first brief of each facade group,
 * order-preserving. Never reorders, never adds, never keeps fewer than 1 brief when the input is
 * non-empty (the first brief always survives, since nothing has been "used" yet when it is
 * considered) — a real, additive tightening of the existing diversity guarantee, never a loosening.
 */
export function dedupeFacadeCollisions<T extends DiversityScoredBrief>(
  briefs: readonly T[],
): readonly T[] {
  const usedFacadeKeys = new Set<string>();
  const kept: T[] = [];
  for (const brief of briefs) {
    const facades = resolvePlausibleFacades(brief.angle);
    const collides = facades.some((pair) => usedFacadeKeys.has(facadePairKey(pair)));
    if (collides) {
      continue;
    }
    for (const pair of facades) {
      usedFacadeKeys.add(facadePairKey(pair));
    }
    kept.push(brief);
  }
  return kept;
}
