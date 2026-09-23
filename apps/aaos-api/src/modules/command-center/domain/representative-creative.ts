/**
 * AAOS Command Center creative thumbnails — the PURE selection of ONE representative Meta creative
 * for a campaign row, extracted into its own testable unit (same "extract the pure unit of work"
 * discipline `meta-sync/domain/build-sync-snapshot.ts` and `opportunities/domain/opportunity.ts`
 * already follow). No I/O, no Meta call, no clock: every input is a real, already-pulled field.
 *
 * The real lineage this walks is: Campaign -> Ad Set -> Ad -> Meta creative (hash | video id).
 * A campaign routinely has MANY ads, so picking "the first one" would show an arbitrary — often
 * paused, often long-dead — creative as the face of the campaign. The priority order below is the
 * spec's, and is applied in full; ties inside a tier are broken deterministically (see
 * `compareCandidates`) so the same real data always yields the same row.
 *
 * Priority (tiers 1-4 are decided here; tier 5 is NOT this function's job):
 *   1. Active WINNING creative — a real A/B-test `WINNER` verdict, or Samantha's real `SCALE`
 *      verdict (see `isWinning`).
 *   2. Active creative with the highest real spend.
 *   3. Active creative with the highest real impressions.
 *   4. Most recently active creative — the newest `createdAt` among ALL candidates, including
 *      paused/archived ones, i.e. "the last creative that actually ran".
 *   5. Listing/property thumbnail — resolved client-side from the real campaign -> `listings.id` ->
 *      `mainPhotoUrl` chain, and reached only when this function returns `undefined`.
 *
 * Only ads that genuinely CARRY a Meta creative ref are candidates at all: an ad with no
 * `creativeAsset` can never yield a Meta thumbnail, so including it could only ever produce a row
 * with a selected ad and no picture.
 */

/** Meta's real `AdStatus.ACTIVE` (`@aos/meta-ads-connector`) — the only status that counts as "active" for tiers 1-3. */
const ACTIVE_STATUS = "ACTIVE";

/** Samantha's real `Verdict.SCALE` — "this is winning, scale it". The honest per-ad winner proxy when no A/B-test decision exists for the ad. */
const VERDICT_SCALE = "SCALE";

/** Samantha's real `Verdict.REFRESH` — the codebase's genuine creative-fatigue signal (`VerdictEngine`). */
const VERDICT_REFRESH = "REFRESH";

/** One candidate ad, carrying only real, already-pulled fields. `status`/`verdict` stay plain strings because the caller's `AdResponseDto` already serialized the connector's enums that way. */
export interface RepresentativeCreativeCandidate {
  /** Real Meta ad id (`Ad.metaId`) — never the internal, per-pull-regenerated `Ad.id`. */
  readonly metaAdId: string;
  /** Real Meta `AdStatus` as a string (`"ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED"`). */
  readonly status: string;
  /** Real Samantha `Verdict` as a string (`"SCALE" | "KEEP" | "REVIEW" | "REFRESH" | "FIX" | "PAUSE"`). */
  readonly verdict: string;
  /** Real `AdMetrics.spend`. */
  readonly spend: number;
  /** Real `AdMetrics.impressions`. */
  readonly impressions: number;
  /** Real `Ad.createdAt` as an ISO string. */
  readonly createdAtIso: string;
  /** Real Meta creative ref — `{kind, ref}` where `ref` is an image HASH or a VIDEO ID. Absent means this ad cannot produce a Meta thumbnail at all. */
  readonly creativeAsset?: { readonly kind: "IMAGE" | "VIDEO"; readonly ref: string };
  /**
   * Real `ab_test_variants.status === "WINNER"` for this exact `meta_ad_id` — the codebase's
   * genuine, human-/threshold-decided A/B-test winner (`abtesting/domain/winner-decision.ts`'s
   * `decideWinner`, persisted by `AbTestingService`). `false` for every ad that was never part of
   * an A/B test, which is most of them — NOT a claim that the ad lost.
   */
  readonly abTestWinner: boolean;
}

/**
 * The small, honest badge shown over a row's thumbnail. Only two values, each traceable to ONE real
 * field — see `deriveBadge` for the exact mapping. Anything else gets NO badge rather than a
 * guessed one.
 */
export type RepresentativeCreativeBadge = "WINNER" | "FATIGUED";

export interface RepresentativeCreativeSelection {
  readonly metaAdId: string;
  readonly kind: "IMAGE" | "VIDEO";
  /** The real Meta image hash / video id. Still NOT a URL — the caller resolves it. */
  readonly metaCreativeRef: string;
  readonly badge?: RepresentativeCreativeBadge;
  /** Which of the 4 priority tiers actually decided this pick — surfaced so a human can tell "this is the winner" from "this is just the newest thing that ran". */
  readonly priorityTier: 1 | 2 | 3 | 4;
}

/**
 * Real A/B-test winner FIRST, Samantha's `SCALE` verdict as the fallback proxy. Both are real
 * fields; `abTestWinner` is the stronger signal (an actual declared winner over a measured Rp/lead
 * margin) so it is checked first, but `SCALE` is what the overwhelming majority of real ads have as
 * their only winner-shaped signal, since most ads were never A/B tested.
 */
function isWinning(candidate: RepresentativeCreativeCandidate): boolean {
  return candidate.abTestWinner || candidate.verdict === VERDICT_SCALE;
}

function isActive(candidate: RepresentativeCreativeCandidate): boolean {
  return candidate.status === ACTIVE_STATUS;
}

/**
 * Deterministic tie-break, applied INSIDE whichever tier selected the candidate set: higher real
 * spend, then higher real impressions, then more recent `createdAt`, then `metaAdId` ascending.
 * The final id comparison exists purely so two genuinely identical ads never flip between requests
 * (a flickering thumbnail would read as a data bug).
 */
function compareCandidates(
  a: RepresentativeCreativeCandidate,
  b: RepresentativeCreativeCandidate,
): number {
  if (a.spend !== b.spend) return b.spend - a.spend;
  if (a.impressions !== b.impressions) return b.impressions - a.impressions;
  const aTime = Date.parse(a.createdAtIso);
  const bTime = Date.parse(b.createdAtIso);
  const aValid = !Number.isNaN(aTime);
  const bValid = !Number.isNaN(bTime);
  if (aValid && bValid && aTime !== bTime) return bTime - aTime;
  if (aValid !== bValid) return aValid ? -1 : 1;
  return a.metaAdId < b.metaAdId ? -1 : a.metaAdId > b.metaAdId ? 1 : 0;
}

/** Most recent real `createdAt` first; an unparseable/absent date sorts last (never treated as "now"). Falls back to `compareCandidates` for an exact tie. */
function compareByRecency(
  a: RepresentativeCreativeCandidate,
  b: RepresentativeCreativeCandidate,
): number {
  const aTime = Date.parse(a.createdAtIso);
  const bTime = Date.parse(b.createdAtIso);
  const aValid = !Number.isNaN(aTime);
  const bValid = !Number.isNaN(bTime);
  if (aValid && bValid && aTime !== bTime) return bTime - aTime;
  if (aValid !== bValid) return aValid ? -1 : 1;
  return compareCandidates(a, b);
}

/**
 * The badge for the SELECTED creative — computed from the selected ad alone, so the badge always
 * describes the creative actually on screen.
 *
 * EXACT mapping, every arm traceable to one real field:
 *  - `WINNER`   <- real `ab_test_variants.status === "WINNER"` for this `meta_ad_id`, OR real
 *                  Samantha `Verdict.SCALE` (`VerdictEngine`'s "this is winning, scale it").
 *  - `FATIGUED` <- real Samantha `Verdict.REFRESH` — `VerdictEngine`'s genuine creative-fatigue
 *                  verdict ("replace this creative"), the only fatigue signal that exists per-ad.
 *  - anything else -> NO badge. `KEEP`/`REVIEW`/`FIX`/`PAUSE` are real verdicts but none of them
 *    means "winning" or "fatigued", and inventing a third badge for them would be a claim the data
 *    does not make.
 *
 * `WINNER` wins a `SCALE`+`REFRESH` collision (`VerdictEngine` cannot emit both, so this is
 * defensive, not a real observed state).
 */
function deriveBadge(
  candidate: RepresentativeCreativeCandidate,
): RepresentativeCreativeBadge | undefined {
  if (isWinning(candidate)) return "WINNER";
  if (candidate.verdict === VERDICT_REFRESH) return "FATIGUED";
  return undefined;
}

function toSelection(
  candidate: RepresentativeCreativeCandidate,
  priorityTier: 1 | 2 | 3 | 4,
): RepresentativeCreativeSelection {
  // Narrowed by `withCreative` before this is ever reached.
  const asset = candidate.creativeAsset as {
    readonly kind: "IMAGE" | "VIDEO";
    readonly ref: string;
  };
  const badge = deriveBadge(candidate);
  return {
    metaAdId: candidate.metaAdId,
    kind: asset.kind,
    metaCreativeRef: asset.ref,
    ...(badge !== undefined ? { badge } : {}),
    priorityTier,
  };
}

function withCreative(
  candidates: readonly RepresentativeCreativeCandidate[],
): readonly RepresentativeCreativeCandidate[] {
  return candidates.filter(
    (candidate) => candidate.creativeAsset !== undefined && candidate.creativeAsset.ref.length > 0,
  );
}

/**
 * Picks the ONE creative that represents a campaign, per the 4 real priority tiers documented at
 * the top of this file. Returns `undefined` when no ad in the campaign carries a real Meta creative
 * ref at all — the honest "fall through to the listing thumbnail (tier 5), then to the placeholder"
 * answer, never a guessed pick.
 */
export function selectRepresentativeCreative(
  candidates: readonly RepresentativeCreativeCandidate[],
): RepresentativeCreativeSelection | undefined {
  const eligible = withCreative(candidates);
  if (eligible.length === 0) {
    return undefined;
  }

  const active = eligible.filter(isActive);

  // Tier 1 — active winning creative.
  const winners = active.filter(isWinning);
  const topWinner = [...winners].sort(compareCandidates)[0];
  if (topWinner !== undefined) {
    return toSelection(topWinner, 1);
  }

  // Tier 2 — active creative with the highest real spend. Requires spend > 0: a set of active ads
  // that have all spent exactly nothing does not have a "highest spender", and claiming one would
  // be indistinguishable from an arbitrary pick.
  const spenders = active.filter((candidate) => candidate.spend > 0);
  const topSpender = [...spenders].sort(compareCandidates)[0];
  if (topSpender !== undefined) {
    return toSelection(topSpender, 2);
  }

  // Tier 3 — active creative with the highest real impressions (same "> 0" reasoning as tier 2).
  const delivered = active.filter((candidate) => candidate.impressions > 0);
  const topImpressions = [...delivered].sort(
    (a, b) => b.impressions - a.impressions || compareCandidates(a, b),
  )[0];
  if (topImpressions !== undefined) {
    return toSelection(topImpressions, 3);
  }

  // Tier 4 — most recently active creative, across EVERY candidate (not just the active ones):
  // a campaign whose ads are all paused still has a real last-run creative, and that is a far more
  // honest face for the row than the listing photo or the placeholder.
  const mostRecent = [...eligible].sort(compareByRecency)[0];
  return mostRecent !== undefined ? toSelection(mostRecent, 4) : undefined;
}
