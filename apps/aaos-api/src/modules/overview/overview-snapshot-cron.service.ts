import { ALL_BRANCH_IDS } from "@aos/branch-manager";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { LeadsService } from "../leads/leads.service.js";
import { MetaAdsService } from "../meta-ads/meta-ads.service.js";
import type { TenantRow } from "../superadmin/infrastructure/tenant.repository.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { OverviewSnapshotRepository } from "./infrastructure/overview-snapshot.repository.js";

/**
 * Real Meta `datePreset` this cron uses when pulling today's campaign spend — the SAME window
 * `OverviewService.getCampaignsSummary`'s own `OVERVIEW_CAMPAIGNS_DATE_PRESET` uses. Kept as its own
 * local constant here (rather than importing that file's private constant) since `OverviewService`
 * does not export it — same "one small duplicated literal, not a duplicated computation" tradeoff
 * this file's own header discusses below.
 */
const SNAPSHOT_CAMPAIGNS_DATE_PRESET = "last_7d" as const;

function toDateKeyUtc(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * `OverviewSnapshotCronService` (EYVRA SAMANTHA V2 + KAI V2 Phase 56 — Command Center "Performance
 * Overview" chart). Real, scheduled daily sweep over every real tenant, writing ONE
 * `overview_daily_snapshots` row per tenant per UTC day.
 *
 * REAL CRON-PLACEMENT DECISION — a NEW, dedicated `@Cron` here, following the SAME real pattern
 * `MetaSyncCronService` (`modules/meta-sync/meta-sync-cron.service.ts`) already establishes for the
 * identical shape of problem: a per-TENANT, unbounded background sweep with no per-tenant
 * enqueue/cooldown state of its own, NOT a due `calendar_events` ROW (`SchedulerService`'s own
 * per-minute loop — see that class's doc comment for why that loop's real unit of iteration doesn't
 * fit this shape either). `TenantRepository.list()` enumeration + per-tenant try/catch isolation,
 * same as `MetaSyncCronService`'s own two sweeps — one tenant's Meta API/lead-store failure must
 * never abort the sweep for the rest.
 *
 * REUSE, NOT A NEW META-PULLING PATH: `computeTotalSpend`/`computeTotalLeads` below call the exact
 * SAME real service methods `OverviewService.getCampaignsSummary`/`getLeadsSummary` already call
 * in-process (`MetaAdsService.getAdAccounts`/`pullCampaigns`, `LeadsService.getLeadsByBranch` fanned
 * out across `ALL_BRANCH_IDS`) — never a second, parallel Meta pull or lead-count computation. The
 * per-account spend aggregation and per-branch lead fan-out are re-implemented here (rather than
 * calling `OverviewService.getOverview` itself) because that method is a much heavier aggregate
 * (activities, judge scores, LLM insight, recycling, heatmap) this cron has no use for and would
 * make one tenant's daily snapshot write depend on sub-systems unrelated to spend/leads.
 *
 * REAL CADENCE CHOICE: `"0 55 23 * * *"` (23:55:00 UTC, six-field-with-seconds convention every
 * other cron in this codebase already uses) — captures each UTC calendar day's near-final real
 * numbers a few minutes before the day rolls over, mirroring `MetaSyncCronService.runDailySnapshot`'s
 * own end-of-day intent (`"0 5 0 * * *"`, just after midnight) but timed to run BEFORE midnight so
 * `snapshot_date` unambiguously matches the day whose numbers were actually captured.
 */
@Injectable()
export class OverviewSnapshotCronService {
  private readonly logger = new Logger(OverviewSnapshotCronService.name);

  constructor(
    private readonly tenants: TenantRepository,
    private readonly metaAdsService: MetaAdsService,
    private readonly leadsService: LeadsService,
    private readonly repository: OverviewSnapshotRepository,
  ) {}

  @Cron("0 55 23 * * *")
  async runDailySnapshotSweep(): Promise<void> {
    const tenants = await this.listTenants();
    if (tenants === undefined) {
      return;
    }

    const snapshotDate = toDateKeyUtc(new Date());
    let succeeded = 0;
    let failed = 0;
    for (const tenant of tenants) {
      try {
        const [totalSpend, totalLeads] = await Promise.all([
          this.computeTotalSpend(tenant.tenant_id),
          this.computeTotalLeads(tenant.tenant_id),
        ]);
        await this.repository.upsert(tenant.tenant_id, snapshotDate, totalSpend, totalLeads);
        succeeded += 1;
      } catch (caught) {
        failed += 1;
        this.logger.warn(
          `OverviewSnapshotCronService.runDailySnapshotSweep: snapshot failed for tenant "${tenant.tenant_id}" — continuing with the rest of the real sweep: ${describeCause(caught)}`,
        );
      }
    }
    if (succeeded > 0 || failed > 0) {
      this.logger.log(
        `OverviewSnapshotCronService.runDailySnapshotSweep: swept ${String(tenants.length)} tenant(s) — ${String(succeeded)} ok, ${String(failed)} failed.`,
      );
    }
  }

  /**
   * Real spend total, reusing `MetaAdsService.getAdAccounts`/`pullCampaigns` EXACTLY the way
   * `OverviewService.getCampaignsSummary` does — every real configured ad account, summed, never a
   * second parallel Meta pull path.
   */
  private async computeTotalSpend(tenantId: string): Promise<number> {
    const accounts = await this.metaAdsService.getAdAccounts(tenantId);
    const adAccountIds = accounts.length > 0 ? accounts.map((account) => account.id) : [undefined];
    const perAccountDtos = await Promise.all(
      adAccountIds.map((adAccountId) =>
        this.metaAdsService.pullCampaigns(
          {
            datePreset: SNAPSHOT_CAMPAIGNS_DATE_PRESET,
            ...(adAccountId !== undefined ? { adAccountId } : {}),
          },
          `overview-snapshot-cron-${tenantId}`,
          tenantId,
        ),
      ),
    );
    return perAccountDtos
      .flatMap((dto) => dto.campaigns)
      .reduce((sum, campaign) => sum + campaign.spend, 0);
  }

  /**
   * Real CRM lead total (`hot + warm + cold`), reusing `LeadsService.getLeadsByBranch` fanned out
   * across `ALL_BRANCH_IDS` EXACTLY the way `OverviewService.getLeadsSummary` does — the SAME real
   * lead count the Command Center KPI strip's own `totalLeads` already shows, never Meta's separate
   * ad-conversion "leads" metric (see `059_overview_daily_snapshots.sql`'s header for why).
   */
  private async computeTotalLeads(tenantId: string): Promise<number> {
    const perBranch = await Promise.all(
      ALL_BRANCH_IDS.map((branchId) => this.leadsService.getLeadsByBranch({ branchId }, tenantId)),
    );
    return perBranch.flat().length;
  }

  /** A `tenants.list()` failure must never crash the sweep — same degrade `MetaSyncCronService.listConnectableTenants` already establishes for the identical real dependency. */
  private async listTenants(): Promise<readonly TenantRow[] | undefined> {
    try {
      return await this.tenants.list();
    } catch (caught) {
      this.logger.warn(
        `OverviewSnapshotCronService.runDailySnapshotSweep: TenantRepository.list failed, skipping this sweep — ${describeCause(caught)}`,
      );
      return undefined;
    }
  }
}
