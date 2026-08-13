import { SalesHumanId } from "@aos/branch-manager";
import { ClosingType, type IClosingRepository, type LeadStore } from "@aos/lead-store";
import { Inject, Injectable } from "@nestjs/common";

import { LEAD_STORE, LEAD_STORE_CLOSING_REPOSITORY } from "../../di-tokens.js";
import { toClosingResponseDto } from "../closings/dto/closing-response.dto.js";

import type { GetSalesStatsQueryDto } from "./dto/get-sales-stats.dto.js";
import type { SalesStatsResponseDto } from "./dto/sales-stats-response.dto.js";

const RECENT_CLOSINGS_LIMIT = 5;

function startOfTodayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

function startOfCurrentMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * `GET /api/v1/sales/stats` — personal stats (spec "/stats" page). `@aos/lead-store`'s
 * `GetClosingStats` aggregates commission/count totals but does not split by `closingType`
 * (test drive vs SPK), so this service fetches this sales human's own closings this month ONCE
 * via the real `ClosingRepository.findByFilter` (AAOS-W4B coordinator note #4's `salesHumanId`
 * filter) and derives every closing-based number from that single list — no duplicate queries,
 * no "fetch everything then filter" (coordinator note #4's explicit warning).
 */
@Injectable()
export class SalesService {
  constructor(
    @Inject(LEAD_STORE) private readonly leadStore: LeadStore,
    @Inject(LEAD_STORE_CLOSING_REPOSITORY)
    private readonly closingRepository: IClosingRepository,
  ) {}

  async getStats(query: GetSalesStatsQueryDto): Promise<SalesStatsResponseDto> {
    const salesHumanIdResult = SalesHumanId.create(query.salesHumanId);
    if (!salesHumanIdResult.ok) {
      throw salesHumanIdResult.error;
    }

    const now = new Date();

    const myLeadsResult = await this.leadStore.getLeadsBySales.execute(salesHumanIdResult.value);
    if (!myLeadsResult.ok) {
      throw myLeadsResult.error;
    }
    const todayStart = startOfTodayUtc(now);
    const leadsToday = myLeadsResult.value.filter(
      (lead) => lead.assignedAt !== undefined && lead.assignedAt >= todayStart,
    ).length;

    const closingsResult = await this.closingRepository.findByFilter({
      salesHumanId: query.salesHumanId,
      fromDate: startOfCurrentMonthUtc(now),
      toDate: now,
    });
    if (!closingsResult.ok) {
      throw closingsResult.error;
    }
    const closingsThisMonth = closingsResult.value;

    const testDriveThisMonth = closingsThisMonth.filter(
      (closing) => closing.closingType === ClosingType.TEST_DRIVE,
    ).length;
    const spkThisMonth = closingsThisMonth.filter(
      (closing) => closing.closingType === ClosingType.SPK,
    ).length;
    const commissionThisMonthIdr = closingsThisMonth.reduce(
      (sum, closing) => sum + (closing.commissionIdr ?? 0),
      0,
    );
    const recentClosings = [...closingsThisMonth]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, RECENT_CLOSINGS_LIMIT)
      .map(toClosingResponseDto);

    return {
      leadsToday,
      testDriveThisMonth,
      spkThisMonth,
      commissionThisMonthIdr,
      recentClosings,
    };
  }
}
