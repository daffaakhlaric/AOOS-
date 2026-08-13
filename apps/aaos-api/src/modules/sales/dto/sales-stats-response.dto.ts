import type { ClosingResponseDto } from "../../closings/dto/closing-response.dto.js";

/**
 * `GET /api/v1/sales/stats` response (spec mockup "Statistik Saya"). Every field is derived from
 * real `@aos/lead-store` data — `leadsToday` from `GetLeadsBySales` filtered to leads assigned
 * today, the rest from this sales human's own closings this month (AAOS-W4B coordinator note #4's
 * `ClosingFilter.salesHumanId`).
 */
export interface SalesStatsResponseDto {
  readonly leadsToday: number;
  readonly testDriveThisMonth: number;
  readonly spkThisMonth: number;
  readonly commissionThisMonthIdr: number;
  readonly recentClosings: readonly ClosingResponseDto[];
}
