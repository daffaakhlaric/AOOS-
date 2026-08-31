import { ConflictError, NotFoundError, ValidationError } from "@aos/errors";
import { createLogger } from "@aos/logger";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import {
  AAOS_API_CONFIG,
  META_ADS_CONNECTOR_REGISTRY,
  SUPABASE_AUTH_ADMIN,
  WEBHOOK_SECRETS_SERVICE,
} from "../../di-tokens.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";
import type { SupabaseAuthAdminLike } from "../sales/infrastructure/supabase-auth-admin.js";
import { WabaConfigRepository } from "../settings/infrastructure/waba-config.repository.js";
import type { WebhookSecretsService } from "../webhook-config/webhook-secrets.service.js";

import type { CreateTenantBodyDto } from "./dto/create-tenant.dto.js";
import type { ImpersonateBodyDto, ImpersonateResponseDto } from "./dto/impersonate.dto.js";
import {
  maskTail,
  type ListTenantsResponseDto,
  type TenantResponseDto,
} from "./dto/tenant-response.dto.js";
import type { UpdateTenantBodyDto } from "./dto/update-tenant.dto.js";
import type {
  PutWebhookConfigBodyDto,
  WebhookConfigResponseDto,
} from "./dto/webhook-config.dto.js";
import type { SystemWebhookConfigRow } from "./infrastructure/system-webhook-config.repository.js";
import { SystemWebhookConfigRepository } from "./infrastructure/system-webhook-config.repository.js";
import type { TenantRow } from "./infrastructure/tenant.repository.js";
import { TenantRepository } from "./infrastructure/tenant.repository.js";

const logger = createLogger({ serviceName: "superadmin" });

/**
 * `modules/superadmin` — Super Admin panel (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Part 1,
 * Phase 1). Coordinator note #1's real integration: tenant admins live in Supabase Auth
 * (`SUPABASE_AUTH_ADMIN`, the same token `modules/sales`'s `SalesHumansService` uses), never a
 * `tenant_admins` table. No custom JWT is minted anywhere in this service.
 *
 * "Login as Tenant" (impersonate): `supabase.auth.admin.generateLink({ type: 'magiclink' })` —
 * mints a REAL Supabase Auth sign-in link for the tenant admin's own account. Chosen over the
 * signed-cookie alternative because it needs no new secret/signing scheme (`JWT_SECRET` is
 * explicitly dropped per coordinator note #1) and produces a genuine, independent tenant-admin
 * session rather than a superadmin session wearing a tenant-id costume. Every impersonation is
 * logged (`logger.warn`, structured, naming the acting superadmin, the target tenant, and the
 * resolved admin email) — never silent.
 */
@Injectable()
export class SuperadminService {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly wabaConfigs: WabaConfigRepository,
    @Inject(SUPABASE_AUTH_ADMIN) private readonly authAdmin: SupabaseAuthAdminLike,
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(META_ADS_CONNECTOR_REGISTRY)
    private readonly metaAdsConnectorRegistry: MetaAdsConnectorRegistry,
    private readonly webhookConfigs: SystemWebhookConfigRepository,
    @Inject(WEBHOOK_SECRETS_SERVICE) private readonly webhookSecrets: WebhookSecretsService,
  ) {}

  private async toDto(row: TenantRow): Promise<TenantResponseDto> {
    const wabaCount = await this.wabaConfigs.countByTenant(row.tenant_id);
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      vertical: row.vertical as "AUTOMOTIVE" | "PROPERTY",
      status: row.status as "TRIAL" | "ACTIVE" | "SUSPENDED",
      ...(row.trial_ends_at !== null ? { trialEndsAt: row.trial_ends_at } : {}),
      hasMetaToken: row.meta_access_token !== null && row.meta_access_token.length > 0,
      ...(row.meta_ad_account_id !== null
        ? { maskedMetaAdAccountId: maskTail(row.meta_ad_account_id) }
        : {}),
      wabaCount,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async list(): Promise<ListTenantsResponseDto> {
    const rows = await this.tenants.list();
    const tenants = await Promise.all(rows.map((row) => this.toDto(row)));
    return {
      kpi: {
        totalTenants: rows.length,
        activeTenants: rows.filter((row) => row.status === "ACTIVE").length,
        trialTenants: rows.filter((row) => row.status === "TRIAL").length,
        suspendedTenants: rows.filter((row) => row.status === "SUSPENDED").length,
      },
      tenants,
    };
  }

  /**
   * (1) checks the slug is free, (2) provisions the real Supabase Auth admin user (mirrors
   * `SalesHumansService.create`), (3) inserts the `tenants` row, (4) optionally inserts ONE
   * `waba_configs` row when the modal's WABA fields were filled in. Best-effort cleanup of the
   * Auth user on a failed tenant-row insert, same discipline as `SalesHumansService.create`.
   */
  async create(dto: CreateTenantBodyDto): Promise<TenantResponseDto> {
    const existing = await this.tenants.findByTenantId(dto.tenantId);
    if (existing !== undefined) {
      throw new ConflictError(`Tenant id "${dto.tenantId}" sudah digunakan`);
    }

    const createResult = await this.authAdmin.auth.admin.createUser({
      email: dto.adminEmail,
      password: dto.adminPassword,
      email_confirm: true,
      user_metadata: { tenantId: dto.tenantId, vertical: dto.vertical, role: "owner" },
    });
    if (createResult.error !== null || createResult.data === null) {
      const message = createResult.error?.message ?? "Supabase Auth createUser returned no user";
      if (/already.*registered|duplicate/i.test(message)) {
        throw new ConflictError(`Email admin "${dto.adminEmail}" sudah terdaftar: ${message}`);
      }
      throw new ValidationError(`Gagal membuat akun admin tenant: ${message}`);
    }
    const authUser = createResult.data.user;

    const trialEndsAt =
      dto.status === "TRIAL"
        ? new Date(Date.now() + (dto.trialDays ?? 30) * 24 * 60 * 60 * 1000).toISOString()
        : null;

    let row: TenantRow;
    try {
      row = await this.tenants.insert({
        tenant_id: dto.tenantId,
        name: dto.name,
        vertical: dto.vertical,
        status: dto.status,
        trial_ends_at: trialEndsAt,
        meta_access_token: dto.metaAccessToken ?? null,
        meta_ad_account_id: dto.metaAdAccountId ?? null,
        meta_api_version: dto.metaApiVersion ?? "v21.0",
        // AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase A: a brand-new tenant starts in DEV — a real,
        // separate, safe application-level default (the column's own DB default stays LIVE, for
        // every tenant that already existed before this migration — see `020_tenant_mode.sql`'s
        // header doc for why the two defaults deliberately differ).
        mode: "DEV",
      });
    } catch (caught) {
      await this.authAdmin.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          tenantId: dto.tenantId,
          vertical: dto.vertical,
          role: "owner",
          provisioningFailed: true,
        },
      });
      throw caught;
    }

    if (dto.waba !== undefined) {
      await this.wabaConfigs.insert({
        tenant_id: dto.tenantId,
        branch_id: dto.waba.branchId.toUpperCase(),
        phone_number: dto.waba.phoneNumber,
        waba_id: dto.waba.wabaId,
        phone_number_id: dto.waba.phoneNumberId,
        access_token: dto.waba.accessToken,
        status: "ACTIVE",
      });
    }

    logger.info(
      `SuperadminService.create: tenant "${dto.tenantId}" created (admin: ${dto.adminEmail})`,
    );
    return this.toDto(row);
  }

  async update(tenantId: string, dto: UpdateTenantBodyDto): Promise<TenantResponseDto> {
    const existing = await this.tenants.findByTenantId(tenantId);
    if (existing === undefined) {
      throw new NotFoundError(`No tenant found for id "${tenantId}"`);
    }
    const row = await this.tenants.updateByTenantId(tenantId, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.vertical !== undefined ? { vertical: dto.vertical } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.trialEndsAt !== undefined ? { trial_ends_at: dto.trialEndsAt } : {}),
      ...(dto.metaAccessToken !== undefined ? { meta_access_token: dto.metaAccessToken } : {}),
      ...(dto.metaAdAccountId !== undefined ? { meta_ad_account_id: dto.metaAdAccountId } : {}),
      ...(dto.metaApiVersion !== undefined ? { meta_api_version: dto.metaApiVersion } : {}),
      updated_at: new Date().toISOString(),
    });
    // Real cache invalidation (AAOS-MULTI-TENANT-PHASE1B Phase 3) — Super Admin editing a
    // tenant's Meta token/ad-account-id is a second real place this data changes (Settings'
    // `updateMeta` is the other) — a stale cached `MetaAdsConnector` must not linger past either.
    this.metaAdsConnectorRegistry.invalidate(tenantId);
    logger.info(`SuperadminService.update: tenant "${tenantId}" updated (status: ${row.status})`);
    return this.toDto(row);
  }

  /**
   * Finds a real Supabase Auth user whose `user_metadata.tenantId` matches (the tenant admin
   * `create()` provisioned, or any later admin sharing the tenant), then mints a real magic-link
   * sign-in for them. `perPage: 1000` — same judgment call as `SalesHumansService.loadAuthUsersById`.
   */
  async impersonate(dto: ImpersonateBodyDto): Promise<ImpersonateResponseDto> {
    const tenant = await this.tenants.findByTenantId(dto.tenantId);
    if (tenant === undefined) {
      throw new NotFoundError(`No tenant found for id "${dto.tenantId}"`);
    }

    const { data, error } = await this.authAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error !== null) {
      throw new ValidationError(`Failed to load Supabase Auth users: ${error.message}`);
    }
    const adminUser = (data?.users ?? []).find(
      (user) =>
        (user.user_metadata as Record<string, unknown> | null)?.["tenantId"] === dto.tenantId,
    );
    if (adminUser === undefined || adminUser.email === undefined) {
      throw new NotFoundError(`No admin account found for tenant "${dto.tenantId}"`);
    }

    const redirectTo =
      this.config.AAOS_DASHBOARD_BASE_URL.length > 0
        ? new URL("/dashboard", this.config.AAOS_DASHBOARD_BASE_URL).toString()
        : undefined;

    const linkResult = await this.authAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: adminUser.email,
      ...(redirectTo !== undefined ? { options: { redirectTo } } : {}),
    });
    if (linkResult.error !== null || linkResult.data === null) {
      throw new ValidationError(
        `Gagal membuat link login tenant: ${linkResult.error?.message ?? "unknown error"}`,
      );
    }

    // IMPERSONATION AUDIT LOG — coordinator note #1's "clearly logged as an impersonation event".
    // Never silent: names the acting superadmin, the target tenant, and the resolved admin email.
    logger.warn(
      `SuperadminService.impersonate: superadmin "${dto.actorEmail}" (${dto.actorId}) ` +
        `impersonated tenant "${dto.tenantId}" as "${adminUser.email}" at ${new Date().toISOString()}`,
    );

    return {
      tenantId: dto.tenantId,
      adminEmail: adminUser.email,
      actionLink: linkResult.data.properties.action_link,
    };
  }

  private toSecretStatus(value: string | null | undefined): {
    readonly set: boolean;
    readonly masked?: string;
  } {
    if (value === null || value === undefined || value.length === 0) {
      return { set: false };
    }
    return { set: true, masked: maskTail(value, 4) };
  }

  /**
   * `GET /api/v1/superadmin/webhook-config` (AAOS-SETTINGS-WEBHOOK-CONFIG, Part C) — NEVER returns
   * a real secret value, only whether an override exists (`*Set`) and a masked tail (`maskTail`,
   * the SAME helper `maskedMetaAdAccountId` already uses). Reads `SystemWebhookConfigRepository`
   * directly (not `WebhookSecretsService`, which resolves the LIVE-EFFECTIVE value including the
   * `.env` fallback — this endpoint's whole point is showing only what's been explicitly
   * OVERRIDDEN in the DB, so a fresh install with no row yet correctly reports every field unset,
   * never a masked `.env` value the superadmin never actually saved).
   */
  async getWebhookConfig(): Promise<WebhookConfigResponseDto> {
    const row = await this.webhookConfigs.get();
    const whatsappVerify = this.toSecretStatus(row?.whatsapp_webhook_verify_token);
    const whatsappSecret = this.toSecretStatus(row?.whatsapp_webhook_app_secret);
    const metaVerify = this.toSecretStatus(row?.meta_webhook_verify_token);
    const metaSecret = this.toSecretStatus(row?.meta_webhook_app_secret);
    return {
      whatsapp: {
        verifyTokenSet: whatsappVerify.set,
        appSecretSet: whatsappSecret.set,
        ...(whatsappVerify.masked !== undefined
          ? { verifyTokenMasked: whatsappVerify.masked }
          : {}),
        ...(whatsappSecret.masked !== undefined ? { appSecretMasked: whatsappSecret.masked } : {}),
      },
      meta: {
        verifyTokenSet: metaVerify.set,
        appSecretSet: metaSecret.set,
        ...(metaVerify.masked !== undefined ? { verifyTokenMasked: metaVerify.masked } : {}),
        ...(metaSecret.masked !== undefined ? { appSecretMasked: metaSecret.masked } : {}),
      },
    };
  }

  /**
   * `PUT /api/v1/superadmin/webhook-config` — an explicitly-provided empty string OR `null` CLEARS
   * that field's override (reverts to `.env`); `undefined` (the field simply omitted) leaves it
   * unchanged (see `PutWebhookConfigBodySchema`'s own doc). Always calls
   * `WebhookSecretsService.invalidate()` on success — same "never let a stale cached value survive
   * past a save" discipline every other settings-write path in this app already follows.
   */
  async updateWebhookConfig(dto: PutWebhookConfigBodyDto): Promise<WebhookConfigResponseDto> {
    const patch: {
      -readonly [
        K in
          | "whatsapp_webhook_verify_token"
          | "whatsapp_webhook_app_secret"
          | "meta_webhook_verify_token"
          | "meta_webhook_app_secret"
      ]?: SystemWebhookConfigRow[K];
    } = {};
    if (dto.whatsapp?.verifyToken !== undefined) {
      patch.whatsapp_webhook_verify_token =
        dto.whatsapp.verifyToken === null || dto.whatsapp.verifyToken.length === 0
          ? null
          : dto.whatsapp.verifyToken;
    }
    if (dto.whatsapp?.appSecret !== undefined) {
      patch.whatsapp_webhook_app_secret =
        dto.whatsapp.appSecret === null || dto.whatsapp.appSecret.length === 0
          ? null
          : dto.whatsapp.appSecret;
    }
    if (dto.meta?.verifyToken !== undefined) {
      patch.meta_webhook_verify_token =
        dto.meta.verifyToken === null || dto.meta.verifyToken.length === 0
          ? null
          : dto.meta.verifyToken;
    }
    if (dto.meta?.appSecret !== undefined) {
      patch.meta_webhook_app_secret =
        dto.meta.appSecret === null || dto.meta.appSecret.length === 0 ? null : dto.meta.appSecret;
    }

    if (Object.keys(patch).length > 0) {
      await this.webhookConfigs.upsert(patch);
    }
    this.webhookSecrets.invalidate();
    logger.info("SuperadminService.updateWebhookConfig: global webhook config saved");
    return this.getWebhookConfig();
  }
}
