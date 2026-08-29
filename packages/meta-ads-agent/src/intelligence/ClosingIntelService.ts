import type { Closing } from "@aos/lead-store";
import { ClosingType } from "@aos/lead-store";

/**
 * AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 1 ("Source 7: Closing History"). Pure — receives
 * already-fetched `Closing[]` (e.g. from `@aos/lead-store`'s real `GetClosingStats`-adjacent
 * `IClosingRepository.findByFilter`), never queries Supabase itself.
 *
 * Per the wider effort's coordinator note point 3 (confirmed via direct read of
 * `packages/lead-store/src/domain/entities/Closing.ts` / migration): the real `closings` table
 * has NO `closing_price` column — only `unitPrice` (the asking price) exists, so the spec's
 * `avgDiscount = (unit_price - closing_price) / unit_price` is UNCOMPUTABLE and is dropped
 * entirely rather than fabricated. Real, buildable fields instead: `unitModel`, `branchId`,
 * `campaignId`, `adId`, and `closingType` (`TEST_DRIVE | SPK | CANCELLED`) — this class builds
 * real closing-rate-per-unit-model and per-branch signals from those.
 *
 * "Closing rate" here means SPK count / total closing-events count for that unit/branch — SPK
 * (Surat Pesanan Kendaraan) is the real "this became a sale" event; `TEST_DRIVE` and `CANCELLED`
 * are the other two real `ClosingType` members and count toward the denominator but not the
 * numerator.
 */
export interface UnitClosingSignal {
  readonly unitModel: string;
  readonly totalEvents: number;
  readonly spkCount: number;
  readonly cancelledCount: number;
  /** `spkCount / totalEvents`. `totalEvents` is always >= 1 for any entry that exists at all (a model/branch only appears here once it has at least one real closing event). */
  readonly closingRate: number;
}

export interface BranchClosingSignal {
  readonly branchId: string;
  readonly totalEvents: number;
  readonly spkCount: number;
  readonly closingRate: number;
}

export interface ClosingIntelSignal {
  readonly totalEvents: number;
  /** Ranked by `spkCount` descending — Samantha's real "top selling unit models" signal. */
  readonly topUnitModels: ReadonlyArray<UnitClosingSignal>;
  readonly byBranch: ReadonlyArray<BranchClosingSignal>;
  /** Unit models ranked LOWEST by `closingRate` (>= `minEventsForAvoid` events, so a 1-event 0% model doesn't dominate) — the honest replacement for the spec's `avoidUnits`. */
  readonly slowUnitModels: ReadonlyArray<UnitClosingSignal>;
}

const DEFAULT_MIN_EVENTS_FOR_AVOID = 3;

export class ClosingIntelService {
  static getClosingSignals(
    closings: ReadonlyArray<Closing>,
    minEventsForAvoid = DEFAULT_MIN_EVENTS_FOR_AVOID,
  ): ClosingIntelSignal {
    const byModel = new Map<string, Closing[]>();
    for (const closing of closings) {
      const key = closing.unitModel;
      if (key === undefined) {
        continue;
      }
      const bucket = byModel.get(key);
      if (bucket) {
        bucket.push(closing);
      } else {
        byModel.set(key, [closing]);
      }
    }

    const unitSignals: UnitClosingSignal[] = [...byModel.entries()].map(([unitModel, events]) => {
      const spkCount = events.filter((e) => e.closingType === ClosingType.SPK).length;
      const cancelledCount = events.filter((e) => e.closingType === ClosingType.CANCELLED).length;
      return {
        unitModel,
        totalEvents: events.length,
        spkCount,
        cancelledCount,
        // No divide-by-zero guard needed: `events` comes from `byModel`, whose only insertion
        // path (above) always pushes at least 1 closing before a key exists — `events.length`
        // is always >= 1 here, by construction.
        closingRate: spkCount / events.length,
      };
    });

    const topUnitModels = [...unitSignals].sort((a, b) => b.spkCount - a.spkCount);
    const slowUnitModels = unitSignals
      .filter((u) => u.totalEvents >= minEventsForAvoid)
      .sort((a, b) => a.closingRate - b.closingRate);

    const byBranchMap = new Map<string, Closing[]>();
    for (const closing of closings) {
      const key = String(closing.branchId);
      const bucket = byBranchMap.get(key);
      if (bucket) {
        bucket.push(closing);
      } else {
        byBranchMap.set(key, [closing]);
      }
    }
    const byBranch: BranchClosingSignal[] = [...byBranchMap.entries()]
      .map(([branchId, events]) => {
        const spkCount = events.filter((e) => e.closingType === ClosingType.SPK).length;
        return {
          branchId,
          totalEvents: events.length,
          spkCount,
          // No divide-by-zero guard needed: same structural guarantee as `unitSignals` above —
          // `byBranchMap` never holds an empty bucket.
          closingRate: spkCount / events.length,
        };
      })
      .sort((a, b) => b.spkCount - a.spkCount);

    return {
      totalEvents: closings.length,
      topUnitModels,
      byBranch,
      slowUnitModels,
    };
  }
}
