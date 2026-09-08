/**
 * AAOS LOOP UPGRADE, Sprint 7 Prompt 18 ("Market Intelligence") — mirrors `aaos-api`'s
 * `MarketSignalsResponseDto`/domain shapes column-for-column (`modules/market-intelligence/dto/
 * market-signals.dto.ts`, `domain/market-signals.ts`). Kept as its own file, same convention
 * `property-objective.types.ts` already establishes for a genuinely separate feature's DTOs rather
 * than folding everything into `dashboard.types.ts`.
 */

export interface SearchTrendKeywordDeltaDto {
  readonly keyword: string;
  readonly delta: string;
  readonly deltaPct: number;
  readonly trend: "RISING" | "STABLE" | "FALLING";
}

export type SearchTrendSignalDto =
  | {
      readonly available: true;
      readonly keywords: readonly SearchTrendKeywordDeltaDto[];
      readonly reasoning: string;
    }
  | { readonly available: false; readonly reason: string };

export type CompetitorAngleTrendSignalDto =
  | {
      readonly available: true;
      readonly angleCounts: Readonly<Record<string, number>>;
      readonly activeAdCount: number;
      readonly topAngle: string | undefined;
      readonly reasoning: string;
    }
  | { readonly available: false; readonly reason: string };

export type KprRateSignalDto =
  | {
      readonly available: true;
      readonly currentPct: number;
      readonly direction: "NAIK" | "TURUN" | "STABIL";
      readonly asOf: string;
      readonly reasoning: string;
    }
  | { readonly available: false; readonly reason: string };

export interface SeasonalitySignalDto {
  readonly available: true;
  readonly status: "musim ramai" | "musim sepi";
  readonly note: string;
  readonly eventName?: string;
  readonly recommendedAngleNote?: string;
}

export interface MarketSignalsDto {
  readonly id: string;
  readonly vertical: string;
  readonly searchTrend: SearchTrendSignalDto;
  readonly competitorAngleTrend: CompetitorAngleTrendSignalDto;
  readonly kprRate: KprRateSignalDto;
  readonly seasonality: SeasonalitySignalDto;
  readonly digestText: string | null;
  readonly generatedAt: string;
}
