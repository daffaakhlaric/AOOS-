import type {
  CompetitorAngleTrendSignal,
  KprRateSignal,
  SearchTrendSignal,
  SeasonalitySignal,
} from "../domain/market-signals.js";
import type { MarketSignalsRow } from "../infrastructure/market-signals.repository.js";

// ---------------------------------------------------------------------------------------------
// `GET /api/v1/market-signals/latest`, `POST /api/v1/market-signals/refresh` — the "Sinyal Pasar"
// card's real backend (AAOS LOOP UPGRADE, Sprint 7 Prompt 18).
// ---------------------------------------------------------------------------------------------

export interface MarketSignalsResponseDto {
  readonly id: string;
  readonly vertical: string;
  readonly searchTrend: SearchTrendSignal;
  readonly competitorAngleTrend: CompetitorAngleTrendSignal;
  readonly kprRate: KprRateSignal;
  readonly seasonality: SeasonalitySignal;
  readonly digestText: string | null;
  readonly generatedAt: string;
}

export function toMarketSignalsResponseDto(row: MarketSignalsRow): MarketSignalsResponseDto {
  return {
    id: row.id,
    vertical: row.vertical,
    searchTrend: row.search_trend_data as SearchTrendSignal,
    competitorAngleTrend: row.competitor_data as CompetitorAngleTrendSignal,
    kprRate: row.kpr_rate_data as KprRateSignal,
    seasonality: row.seasonal_data as SeasonalitySignal,
    digestText: row.digest_text,
    generatedAt: row.generated_at,
  };
}
