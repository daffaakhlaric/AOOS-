import { NotFoundError } from "@aos/errors";
import type { MetaAdsConnector } from "@aos/meta-ads-connector";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import {
  AAOS_API_CONFIG,
  META_ADS_CONNECTOR,
  META_ADS_CONNECTOR_REGISTRY,
  WHATSAPP_CONNECTOR_REGISTRY,
} from "../../di-tokens.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";
import { maskTail } from "../superadmin/dto/tenant-response.dto.js";
import type { TenantRow } from "../superadmin/infrastructure/tenant.repository.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";
import type { WhatsAppConnectorRegistry } from "../whatsapp/infrastructure/whatsapp-connector-registry.js";

import type { SettingsResponseDto } from "./dto/settings-response.dto.js";
import type {
  TestMetaConnectionResponseDto,
  UpdateMetaSettingsBodyDto,
} from "./dto/update-meta-settings.dto.js";
import type { UpdateModeBodyDto } from "./dto/update-mode.dto.js";
import type {
  CreateWabaConfigBodyDto,
  TestWabaConnectionResponseDto,
  UpdateWabaConfigBodyDto,
  WabaConfigResponseDto,
} from "./dto/waba-config.dto.js";
import type { WabaConfigRow } from "./infrastructure/waba-config.repository.js";
import { WabaConfigRepository } from "./infrastructure/waba-config.repository.js";
import { testWabaConnection } from "./infrastructure/waba-connection-tester.js";

function toWabaDto(row: WabaConfigRow): WabaConfigResponseDto {
  return {
    id: row.id,
    branchId: row.branch_id,
    phoneNumber: row.phone_number,
    wabaId: row.waba_id,
    phoneNumberId: row.phone_number_id,
    maskedAccessToken: maskTail(row.access_token, 4),
    status: row.status as "ACTIVE" | "INACTIVE",
    ...(row.last_tested_at !== null ? { lastTestedAt: row.last_tested_at } : {}),
    ...(row.last_test_result !== null ? { lastTestResult: row.last_test_result } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * `modules/settings` — the tenant Settings page (`/settings`, AAOS-MULTI-TENANT-SUPERADMIN-
 * PROPERTY Phase 1 Part 2/4). Every method is tenant-scoped via the real `tenants` row (coordinator
 * note section 2 — the FIRST module in this app built tenant-scoped from the start rather than
 * relying on `AAOS_API_CONFIG.AAOS_TENANT_ID`/a column default).
 *
 * Per-tenant Meta token (coordinator note section 4): `MetaAdsConnectorFactory`'s composed
 * `MetaAdsConnector.client` already accepts `accessToken` as a per-call parameter on every real
 * Meta API method (`IMetaAdsClient` — verified by reading that contract before writing this
 * file), so no factory/DI refactor was needed to make a single call use a different token than
 * the one baked into `AAOS_API_CONFIG` at boot. What full "request-scoped" tenant resolution
 * would still require — every EXISTING call site (`MetaAdsService.pullCampaigns`/
 * `executeVerdict`/`getAdAccounts`) resolving the caller's tenant and passing ITS token instead
 * of always passing `config.META_ACCESS_TOKEN` — is the larger, deferred Phase 1b sweep. This
 * service implements the real per-tenant path for the ONE place coordinator note section 4
 * requires it now: `testMetaConnection` below deliberately does NOT fall back to the env-var
 * token (unlike `getMeta`'s read view, which is allowed to report the env default exists) —
 * testing the env default would defeat the purpose of a per-tenant connectivity check.
 *
 * AAOS-MULTI-TENANT-PHASE1B (Phase 3) — deliberately KEEPS injecting the static `META_ADS_CONNECTOR`
 * (not `MetaAdsConnectorRegistry`) here: `testMetaConnection` already calls
 * `connector.client.getAdAccount(tenant.meta_ad_account_id, tenant.meta_access_token)` with the
 * tenant's own token/ad-account-id passed EXPLICITLY per call (confirmed by direct read of
 * `IMetaAdsClient` — every real Meta Ads Platform method takes `accessToken` as a parameter, never
 * a connector-level baked-in credential), so this method was already fully tenant-correct before
 * this phase. Composing a whole extra per-tenant `MetaAdsConnector` via the registry just to reach
 * the same stateless `.client.getAdAccount` call would be pure overhead, not a correctness fix.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly wabaConfigs: WabaConfigRepository,
    @Inject(META_ADS_CONNECTOR) private readonly connector: MetaAdsConnector,
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(WHATSAPP_CONNECTOR_REGISTRY)
    private readonly whatsAppConnectorRegistry: WhatsAppConnectorRegistry,
    @Inject(META_ADS_CONNECTOR_REGISTRY)
    private readonly metaAdsConnectorRegistry: MetaAdsConnectorRegistry,
  ) {}

  private async requireTenant(tenantId: string): Promise<TenantRow> {
    const tenant = await this.tenants.findByTenantId(tenantId);
    if (tenant === undefined) {
      throw new NotFoundError(`No tenant found for id "${tenantId}"`);
    }
    return tenant;
  }

  async getSettings(tenantId: string): Promise<SettingsResponseDto> {
    const tenant = await this.requireTenant(tenantId);
    const hasOwnToken = tenant.meta_access_token !== null && tenant.meta_access_token.length > 0;
    return {
      tenant: {
        tenantId: tenant.tenant_id,
        name: tenant.name,
        vertical: tenant.vertical as "AUTOMOTIVE" | "PROPERTY",
        status: tenant.status as "TRIAL" | "ACTIVE" | "SUSPENDED",
        ...(tenant.trial_ends_at !== null ? { trialEndsAt: tenant.trial_ends_at } : {}),
        mode: tenant.mode === "DEV" ? "DEV" : "LIVE",
        ...(tenant.mode_changed_at !== null ? { modeChangedAt: tenant.mode_changed_at } : {}),
        ...(tenant.mode_changed_by !== null ? { modeChangedBy: tenant.mode_changed_by } : {}),
      },
      meta: {
        ...(tenant.meta_ad_account_id !== null
          ? { adAccountId: tenant.meta_ad_account_id }
          : this.config.META_AD_ACCOUNT_IDS[0] !== undefined
            ? { adAccountId: this.config.META_AD_ACCOUNT_IDS[0] }
            : {}),
        ...(hasOwnToken ? { accessToken: tenant.meta_access_token as string } : {}),
        apiVersion: tenant.meta_api_version ?? this.config.META_API_VERSION,
        hasToken: hasOwnToken || this.config.META_ACCESS_TOKEN.length > 0,
        usingEnvDefault: !hasOwnToken,
      },
    };
  }

  async updateMeta(tenantId: string, dto: UpdateMetaSettingsBodyDto): Promise<SettingsResponseDto> {
    await this.requireTenant(tenantId);
    await this.tenants.updateByTenantId(tenantId, {
      ...(dto.accessToken !== undefined ? { meta_access_token: dto.accessToken } : {}),
      ...(dto.adAccountId !== undefined ? { meta_ad_account_id: dto.adAccountId } : {}),
      ...(dto.apiVersion !== undefined ? { meta_api_version: dto.apiVersion } : {}),
      updated_at: new Date().toISOString(),
    });
    // Real cache invalidation (AAOS-MULTI-TENANT-PHASE1B Phase 3, same discipline as
    // `whatsAppConnectorRegistry.invalidate` below) — a saved token/ad-account-id/api-version
    // means the tenant's next-resolved `MetaAdsConnector` must reflect it, never a stale cached
    // instance built from the row's PREVIOUS values.
    this.metaAdsConnectorRegistry.invalidate(tenantId);
    return this.getSettings(tenantId);
  }

  /**
   * `PATCH /api/v1/settings/mode` (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase A point 4) — the "Mode
   * Operasi" card's confirm-dialog action. Writes a real audit trail on every call
   * (`mode_changed_at`/`mode_changed_by`), never only the `mode` value itself — `ModeGuardService`
   * reads `mode` fresh (no cache) on its very next `executeOrSimulate` call, so no cache
   * invalidation is needed here (contrast with `updateMeta`'s `metaAdsConnectorRegistry.invalidate`
   * above, which exists specifically because THAT registry DOES long-lived-cache its resolved
   * connector).
   */
  async updateMode(tenantId: string, dto: UpdateModeBodyDto): Promise<SettingsResponseDto> {
    await this.requireTenant(tenantId);
    await this.tenants.updateByTenantId(tenantId, {
      mode: dto.mode,
      mode_changed_at: new Date().toISOString(),
      mode_changed_by: dto.changedBy ?? null,
      updated_at: new Date().toISOString(),
    });
    return this.getSettings(tenantId);
  }

  /**
   * Real "Test Koneksi" — `GET /{ad_account_id}?fields=name` against the tenant's OWN saved
   * token/ad-account-id (never the env default; see class doc). Reuses
   * `MetaAdsConnector.client.getAdAccount`, the exact same lightweight lookup
   * `MetaAdsService.getAdAccounts` already uses elsewhere in this app — no second Meta API call
   * path invented for this one button.
   */
  async testMetaConnection(tenantId: string): Promise<TestMetaConnectionResponseDto> {
    const tenant = await this.requireTenant(tenantId);
    if (tenant.meta_access_token === null || tenant.meta_access_token.length === 0) {
      return {
        success: false,
        message:
          "Belum ada Meta Access Token tersimpan untuk tenant ini — isi dan simpan token terlebih dahulu sebelum menguji koneksi.",
      };
    }
    if (tenant.meta_ad_account_id === null || tenant.meta_ad_account_id.length === 0) {
      return {
        success: false,
        message:
          "Belum ada Ad Account ID tersimpan untuk tenant ini — isi dan simpan Ad Account ID terlebih dahulu sebelum menguji koneksi.",
      };
    }

    const result = await this.connector.client.getAdAccount(
      tenant.meta_ad_account_id,
      tenant.meta_access_token,
    );
    if (!result.ok) {
      return { success: false, message: `Koneksi Meta Ads gagal: ${result.error.message}` };
    }
    return {
      success: true,
      message: `Terhubung — ${result.value.name}`,
      accountName: result.value.name,
    };
  }

  async listWaba(tenantId: string): Promise<readonly WabaConfigResponseDto[]> {
    await this.requireTenant(tenantId);
    const rows = await this.wabaConfigs.listByTenant(tenantId);
    return rows.map(toWabaDto);
  }

  async createWaba(tenantId: string, dto: CreateWabaConfigBodyDto): Promise<WabaConfigResponseDto> {
    await this.requireTenant(tenantId);
    const row = await this.wabaConfigs.insert({
      tenant_id: tenantId,
      branch_id: dto.branchId.toUpperCase(),
      phone_number: dto.phoneNumber,
      waba_id: dto.wabaId,
      phone_number_id: dto.phoneNumberId,
      access_token: dto.accessToken,
      status: "ACTIVE",
    });
    // Real cache invalidation (coordinator note point 2's "wire cache invalidation into it") —
    // a brand-new WABA card means the tenant's next-resolved `WhatsAppConnector` must include it,
    // never a stale cached instance built before this row existed.
    this.whatsAppConnectorRegistry.invalidate(tenantId);
    return toWabaDto(row);
  }

  private async requireWaba(tenantId: string, id: string): Promise<WabaConfigRow> {
    const row = await this.wabaConfigs.findById(id);
    if (row === undefined || row.tenant_id !== tenantId) {
      throw new NotFoundError(`No WABA config found for id "${id}"`);
    }
    return row;
  }

  async updateWaba(
    tenantId: string,
    id: string,
    dto: UpdateWabaConfigBodyDto,
  ): Promise<WabaConfigResponseDto> {
    await this.requireWaba(tenantId, id);
    const row = await this.wabaConfigs.updateById(id, {
      ...(dto.branchId !== undefined ? { branch_id: dto.branchId.toUpperCase() } : {}),
      ...(dto.phoneNumber !== undefined ? { phone_number: dto.phoneNumber } : {}),
      ...(dto.wabaId !== undefined ? { waba_id: dto.wabaId } : {}),
      ...(dto.phoneNumberId !== undefined ? { phone_number_id: dto.phoneNumberId } : {}),
      ...(dto.accessToken !== undefined ? { access_token: dto.accessToken } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      updated_at: new Date().toISOString(),
    });
    // Real cache invalidation — an edited token/phone_number_id/branch must never keep serving
    // through a stale cached `WhatsAppConnector` built from the row's PREVIOUS values.
    this.whatsAppConnectorRegistry.invalidate(tenantId);
    return toWabaDto(row);
  }

  async deleteWaba(tenantId: string, id: string): Promise<void> {
    await this.requireWaba(tenantId, id);
    await this.wabaConfigs.deleteById(id);
    // Real cache invalidation — a deleted WABA card must be gone from the tenant's next-resolved
    // connector too (its `wabaAccounts[]` should no longer register that branch/phone number).
    this.whatsAppConnectorRegistry.invalidate(tenantId);
  }

  /**
   * Real (best-effort) connectivity check — see `waba-connection-tester.ts`'s class doc for why
   * this is a direct Graph API call rather than a `packages/whatsapp-connector` method. Persists
   * the result onto the row (`last_tested_at`/`last_test_result`) so the Settings table can show
   * it without a second round trip.
   */
  async testWaba(tenantId: string, id: string): Promise<TestWabaConnectionResponseDto> {
    const row = await this.requireWaba(tenantId, id);
    const result = await testWabaConnection(row.phone_number_id, row.access_token);
    await this.wabaConfigs.updateById(id, {
      last_tested_at: new Date().toISOString(),
      last_test_result: result.message,
      ...(result.success ? {} : { status: "INACTIVE" }),
    });
    // Real cache invalidation — a failed test flips this row to INACTIVE, which the registry
    // filters out of the connector it composes (see `WhatsAppConnectorRegistry.resolve`'s doc);
    // a stale cached connector must not keep routing to a branch this tenant just marked broken.
    if (!result.success) {
      this.whatsAppConnectorRegistry.invalidate(tenantId);
    }
    return result;
  }

  /**
   * Real "Test Koneksi" for `WabaConfigModal`'s Add/Edit form — Part A of the coordinator note.
   * Tests the raw, UNSAVED `phoneNumberId`/`accessToken` the user has currently typed, via the
   * exact same `testWabaConnection` free function `testWaba` above uses for a saved row. No DB
   * read, no DB write — there is nothing to persist a result onto yet (this is a pre-save probe).
   */
  async testWabaDraft(
    phoneNumberId: string,
    accessToken: string,
  ): Promise<TestWabaConnectionResponseDto> {
    return testWabaConnection(phoneNumberId, accessToken);
  }
}
