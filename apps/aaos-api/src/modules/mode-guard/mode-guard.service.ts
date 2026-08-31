import { Injectable, Logger } from "@nestjs/common";

import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

export type TenantMode = "DEV" | "LIVE";

/**
 * `modules/mode-guard` (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase A) — the real, per-tenant,
 * DB-driven generalization of `GO_LIVE_DRY_RUN`'s execute-vs-simulate SHAPE (see
 * `modules/go-live/go-live.service.ts`, which stays untouched: it remains a separate, still-valid
 * GLOBAL kill-switch layered UNDER this per-tenant gate, not replaced by it).
 *
 * Deliberately NO long-lived cache (unlike `MetaAdsConnectorRegistry`/`WhatsAppConnectorRegistry`,
 * which cache a resolved connector until an explicit `.invalidate(tenantId)` write-path call): a
 * tenant flipping `PATCH /api/v1/settings/mode` must see the new mode take effect on the very next
 * `executeOrSimulate` call, not the next cache-invalidating event. `TenantRepository.findByTenantId`
 * is cheap (one indexed `tenants` row read) and every real Meta-mutating call site already does a
 * comparable per-call read (resolving its `MetaAdsConnector`/`WhatsAppConnector`), so this adds no
 * meaningfully new cost.
 *
 * Fails open to `LIVE` when a tenant row can't be found (mirrors this column's own DB default,
 * `020_tenant_mode.sql`) — a lookup failure here must never silently downgrade a tenant that was
 * always LIVE (e.g. `dss-motor`, resolved via the static `AAOS_API_CONFIG.AAOS_TENANT_ID` today,
 * per every existing call site's own "no per-request tenant context yet" note) into DEV. Logged as
 * a warning, never thrown — same "never turn a missing-config read into a hard failure on a path
 * that must keep working" discipline `WebhookSecretsService.getRowSafely` establishes.
 */
@Injectable()
export class ModeGuardService {
  private readonly logger = new Logger(ModeGuardService.name);

  constructor(private readonly tenants: TenantRepository) {}

  async resolveMode(tenantId: string): Promise<TenantMode> {
    let tenant;
    try {
      tenant = await this.tenants.findByTenantId(tenantId);
    } catch (caught) {
      this.logger.warn(
        `ModeGuardService.resolveMode(${tenantId}) failed to read tenants row — failing open to LIVE: ${String(caught)}`,
      );
      return "LIVE";
    }
    if (tenant === undefined) {
      this.logger.warn(
        `ModeGuardService.resolveMode(${tenantId}): no tenants row found — failing open to LIVE`,
      );
      return "LIVE";
    }
    return tenant.mode === "DEV" ? "DEV" : "LIVE";
  }

  /**
   * Resolves `tenantId`'s real, current mode (no caching — see class doc) and calls `simulateFn()`
   * when `DEV`, `executeFn()` when `LIVE`. Generic over `T` so every real call site (Meta verdict
   * execution, campaign creation, ...) can return its own real response DTO shape — this service
   * never invents a shared "execution result" type of its own.
   */
  async executeOrSimulate<T>(
    tenantId: string,
    executeFn: () => Promise<T>,
    simulateFn: () => Promise<T>,
  ): Promise<T> {
    const mode = await this.resolveMode(tenantId);
    return mode === "DEV" ? simulateFn() : executeFn();
  }
}
