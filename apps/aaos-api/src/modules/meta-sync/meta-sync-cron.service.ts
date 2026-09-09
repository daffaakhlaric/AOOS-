import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import type { TenantRow } from "../superadmin/infrastructure/tenant.repository.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { MetaSyncService } from "./meta-sync.service.js";

/**
 * `MetaSyncCronService` (EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 4). Real, scheduled sweeps over
 * every real Meta-connected tenant, calling `MetaSyncService`'s per-tenant sync methods.
 *
 * REAL CRON-PLACEMENT DECISION — a NEW, dedicated `@Cron` here, NOT folded into
 * `SchedulerService`'s existing per-minute loop. Investigated `SchedulerService.checkDueCalendar`
 * (its one real `@Cron('* * * * *')`) before deciding: that loop's real unit of iteration is DUE
 * `calendar_events` ROWS (a due-window query over a `PENDING` event queue — `AB_TEST_CHECK`,
 * `LOOKALIKE_SYNC`, `RECYCLING_RUN`, `SAMANTHA_INTELLIGENCE_REFRESH`, `MARKET_INTELLIGENCE_REFRESH`
 * all follow the SAME real "enqueue a due event, the per-minute loop dispatches it" shape). A
 * whole-ad-account campaign/insights sync is not a due EVENT at all — it is a per-TENANT, unbounded
 * background refresh with no per-tenant enqueue/cooldown state of its own — forcing it into that
 * loop would mean inventing a synthetic recurring `calendar_events` row per tenant just to reuse the
 * dispatch mechanism, a real, avoidable distortion of what that queue means.
 *
 * The genuinely matching, ALREADY-ESTABLISHED precedent in this exact sprint's own codebase is
 * `MetaOAuthRefreshCronService` (Sprint 2) — a dedicated `@Cron`, its own `TenantRepository.list()`
 * enumeration, per-tenant try/catch isolation, for the SAME real shape of problem ("sweep every
 * Meta-connected tenant, do one real thing per tenant, never let one tenant's failure stop the
 * rest"). This class follows that SAME real pattern rather than `SchedulerService`'s due-event
 * dispatch shape — the more honest, less-duplicative choice: reusing an existing SIMILAR-SHAPED
 * cron's pattern, not distorting a DIFFERENTLY-SHAPED one's real meaning.
 *
 * PER-TENANT ERROR ISOLATION (real, verified): both sweeps below wrap EACH tenant's call in its own
 * try/catch — one tenant's pull failure (bad/expired token, Meta rate limit, malformed response)
 * never stops the sweep for any other tenant, matching `MetaOAuthRefreshCronService.
 * runDailyRefreshSweep`'s own real discipline exactly.
 */
@Injectable()
export class MetaSyncCronService {
  private readonly logger = new Logger(MetaSyncCronService.name);

  constructor(
    private readonly tenants: TenantRepository,
    private readonly metaSync: MetaSyncService,
  ) {}

  /** Real cadence: every 15 minutes, per the user's own Prompt 6 spec (six-field cron, seconds first: second 0, minute-step 15). */
  @Cron("0 */15 * * * *")
  async runPeriodicInsightsSync(): Promise<void> {
    const tenants = await this.listConnectableTenants("runPeriodicInsightsSync");
    if (tenants === undefined) {
      return;
    }
    let succeeded = 0;
    let failed = 0;
    for (const tenant of tenants) {
      try {
        await this.metaSync.syncAllCampaignInsights(tenant.tenant_id);
        succeeded += 1;
      } catch (caught) {
        failed += 1;
        this.logger.warn(
          `MetaSyncCronService.runPeriodicInsightsSync: sync failed for tenant "${tenant.tenant_id}" — continuing with the rest of the real sweep: ${describeCause(caught)}`,
        );
      }
    }
    if (succeeded > 0 || failed > 0) {
      this.logger.log(
        `MetaSyncCronService.runPeriodicInsightsSync: swept ${String(tenants.length)} tenant(s) — ${String(succeeded)} ok, ${String(failed)} failed.`,
      );
    }
  }

  /**
   * Real cadence: daily at 00:05 (`accuracy-check.service.ts`'s own `@Cron("0 9 * * MON")`
   * 6-field-with-seconds convention followed exactly — `"0 5 0 * * *"` = second 0, minute 5,
   * hour 0).
   */
  @Cron("0 5 0 * * *")
  async runDailySnapshot(): Promise<void> {
    const tenants = await this.listConnectableTenants("runDailySnapshot");
    if (tenants === undefined) {
      return;
    }
    const referenceNow = new Date();
    let succeeded = 0;
    let failed = 0;
    for (const tenant of tenants) {
      try {
        await this.metaSync.saveDailySnapshot(tenant.tenant_id, referenceNow);
        succeeded += 1;
      } catch (caught) {
        failed += 1;
        this.logger.warn(
          `MetaSyncCronService.runDailySnapshot: snapshot failed for tenant "${tenant.tenant_id}" — continuing with the rest of the real sweep: ${describeCause(caught)}`,
        );
      }
    }
    if (succeeded > 0 || failed > 0) {
      this.logger.log(
        `MetaSyncCronService.runDailySnapshot: swept ${String(tenants.length)} tenant(s) — ${String(succeeded)} ok, ${String(failed)} failed.`,
      );
    }
  }

  /** A `tenants.list()` failure must never crash the sweep — same degrade `MetaOAuthRefreshCronService.runDailyRefreshSweep` already establishes for the identical real dependency. */
  private async listConnectableTenants(
    callerName: string,
  ): Promise<readonly TenantRow[] | undefined> {
    try {
      return await this.tenants.list();
    } catch (caught) {
      this.logger.warn(
        `MetaSyncCronService.${callerName}: TenantRepository.list failed, skipping this sweep — ${describeCause(caught)}`,
      );
      return undefined;
    }
  }
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
