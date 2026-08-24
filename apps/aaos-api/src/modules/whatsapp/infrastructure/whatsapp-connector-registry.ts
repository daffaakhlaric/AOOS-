import { err, ok, type Result } from "@aos/common";
import { UnavailableError } from "@aos/errors";
import type { IPublisher } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";
import { Branch } from "@aos/meta-ads-connector";
import {
  WhatsAppConnectorFactory,
  parseWhatsAppConnectorConfig,
  type WhatsAppConnector,
  type WhatsAppConnectorWabaAccountConfig,
} from "@aos/whatsapp-connector";

import type { AaosApiConfig } from "../../../config/aaos-api.config.js";
import type {
  WabaConfigRepository,
  WabaConfigRow,
} from "../../settings/infrastructure/waba-config.repository.js";

const WHATSAPP_BASE_URL = "https://graph.facebook.com";
const BRANCH_VALUES = new Set<string>(Object.values(Branch));

/** Real, honest failure — a tenant has no `waba_configs` rows yet (or its rows fail Zod validation). Never a thrown exception, never a silent fallback to the static single-tenant connector. */
export class ConnectorNotConfiguredError extends UnavailableError {
  constructor(tenantId: string, cause?: unknown) {
    super(`No WhatsApp Business Account configured for tenant "${tenantId}"`, { cause });
  }
}

/**
 * AAOS-MULTI-TENANT-PHASE1B (Phase 2) — the real per-tenant `WhatsAppConnector` resolver, replacing
 * the single static connector `app.module.ts` used to compose once at boot for every tenant.
 *
 * DESIGN RESOLUTION — "one connector-level accessToken vs per-waba-account token" (flagged as an
 * open question in the coordinator's own note, point 2): confirmed by direct read of
 * `WhatsAppConnectorFactory.create` that `SendTextMessage`/`SendTemplateMessage`/
 * `SendInteractiveMessage` are each constructed with exactly ONE `options.config.accessToken` —
 * baked in once at factory-composition time, never resolved per-`wabaAccounts[]` entry at send
 * time. Meanwhile `waba_configs` stores an `access_token` PER ROW (per branch), matching the real
 * WhatsApp Business Platform "System User token, one row saved per WABA card the tenant added in
 * Settings" shape. Since a real WhatsApp access token is a Business-Manager-scoped System User
 * token (not a per-phone-number credential), the practical expectation is that every branch a
 * tenant configures shares the SAME underlying token (same Business Manager) — so this class uses
 * the FIRST row's `access_token` (ordered by `listByTenant`'s `created_at ASC`) as the
 * connector-level token for that tenant, and every row's `phone_number_id`/`waba_id`/`branch_id`
 * still gets registered into the connector's `wabaAccounts[]` (so inbound webhook routing and
 * outbound `branch`-keyed sends work for EVERY branch, not just the first). If a tenant's rows
 * genuinely carry different tokens (multiple Business Managers under one tenant — not the common
 * case, but real data can't be assumed clean), that's a real footgun worth surfacing, not silently
 * swallowing — logged as a warning naming the tenant, never thrown (a stale/mismatched token is a
 * config problem to fix in Settings, not a reason to refuse composing a connector for every OTHER
 * correctly-configured branch).
 *
 * DSS-MOTOR BACKWARD COMPAT: `resolve(tenantId)` special-cases `tenantId ===
 * config.AAOS_TENANT_ID` to return the SAME statically-composed `WhatsAppConnector` `app.module.ts`
 * already builds from `.env` (`WHATSAPP_ACCESS_TOKEN`/`WABA_ID_*`/etc.) — the one seeded, already-
 * live `dss-motor` tenant predates `waba_configs` and has never had its WABA rows backfilled into
 * that table. This avoids BOTH a redundant live Supabase query for the one tenant whose config is
 * already known at boot, AND a real behavior change/outage for `dss-motor`'s live WhatsApp traffic
 * the day this phase ships.
 */
export class WhatsAppConnectorRegistry {
  private readonly cache = new Map<string, WhatsAppConnector>();
  private readonly logger: Logger;

  constructor(
    private readonly wabaConfigs: WabaConfigRepository,
    private readonly config: AaosApiConfig,
    private readonly publisher: IPublisher,
    private readonly staticConnector: WhatsAppConnector,
    logger?: Logger,
  ) {
    this.logger = logger ?? createLogger({ serviceName: "whatsapp-connector-registry" });
  }

  async resolve(tenantId: string): Promise<Result<WhatsAppConnector, ConnectorNotConfiguredError>> {
    const cached = this.cache.get(tenantId);
    if (cached !== undefined) {
      return ok(cached);
    }

    if (tenantId === this.config.AAOS_TENANT_ID) {
      this.cache.set(tenantId, this.staticConnector);
      return ok(this.staticConnector);
    }

    // Only real, currently-ACTIVE rows are registered — `status` exists precisely so a tenant (or
    // a failed "Test Koneksi") can mark a WABA card unusable without deleting it; an INACTIVE row
    // should not be sendable/routable, same discipline as `SettingsService.getSettings` already
    // applies to `hasOwnToken`.
    const allRows = await this.wabaConfigs.listByTenant(tenantId);
    const rows = allRows.filter((row) => row.status === "ACTIVE");
    if (rows.length === 0) {
      return err(new ConnectorNotConfiguredError(tenantId));
    }

    const distinctTokens = new Set(rows.map((row) => row.access_token));
    if (distinctTokens.size > 1) {
      this.logger.warn(
        { tenantId, distinctTokenCount: distinctTokens.size },
        "WhatsAppConnectorRegistry: tenant has multiple distinct WABA access_tokens across branches — the composed WhatsAppConnector supports only ONE connector-level token; using the first row's token (oldest by created_at). Other branches' saved tokens are not used for outbound sending until this is reconciled in Settings.",
      );
    }

    const configResult = parseWhatsAppConnectorConfig({
      apiVersion: "v21.0",
      baseUrl: WHATSAPP_BASE_URL,
      accessToken: rows[0]?.access_token ?? "",
      webhookVerifyToken: this.config.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      webhookAppSecret: this.config.WHATSAPP_WEBHOOK_APP_SECRET,
      tenantId,
      wabaAccounts: rows.map(toWabaAccountConfig),
    });
    if (!configResult.ok) {
      this.logger.warn(
        { tenantId, error: configResult.error.message },
        "WhatsAppConnectorRegistry: tenant's waba_configs rows failed WhatsAppConnectorConfig validation",
      );
      return err(new ConnectorNotConfiguredError(tenantId, configResult.error));
    }

    const connector = WhatsAppConnectorFactory.create({
      config: configResult.value,
      publisher: this.publisher,
    });
    this.cache.set(tenantId, connector);
    return ok(connector);
  }

  /** Real cache invalidation — wired into Settings' WABA create/update/delete/test flow (see `SettingsService`) so a stale cached connector (old token/phone numbers) never lingers past a tenant's own save. Safe to call for a tenant with nothing cached (a no-op `Map.delete`). Deliberately never invalidates the `dss-motor` static-fallback entry — that connector is process-boot-composed from `.env`, not from `waba_configs`, so no `waba_configs` write can make it stale. */
  invalidate(tenantId: string): void {
    if (tenantId === this.config.AAOS_TENANT_ID) {
      return;
    }
    this.cache.delete(tenantId);
  }
}

/** Real `branch_id` (free `TEXT` in `waba_configs`) -> `Branch` enum mapping. Judgment call mirroring `to-whatsapp-connector-config.ts`'s own precedent for `WABA_ID_PONDOK_BAMBU` -> `Branch.UMUM`: any saved `branch_id` that isn't a real `Branch` enum member (case-insensitive) falls back to `Branch.UMUM` rather than being rejected outright — Settings' `CreateWabaConfigBodySchema` accepts arbitrary non-empty text for `branchId`, so this is real data this class must handle, not a validation gap to close here. */
function toBranchOrUmum(branchId: string): Branch {
  const upper = branchId.toUpperCase();
  return BRANCH_VALUES.has(upper) ? (upper as Branch) : Branch.UMUM;
}

function toWabaAccountConfig(row: WabaConfigRow): WhatsAppConnectorWabaAccountConfig {
  return {
    wabaId: row.waba_id,
    phoneNumberId: row.phone_number_id,
    phoneNumber: row.phone_number,
    branch: toBranchOrUmum(row.branch_id),
    displayName: `${row.tenant_id} ${row.branch_id}`,
  };
}
