/**
 * Mirrors `apps/aaos-api`'s `modules/superadmin`/`modules/settings` DTOs exactly
 * (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 1) — the wire contract between this app's
 * `/api/superadmin/*`/`/api/settings/*` route handlers and the real backend.
 */

export type Vertical = "AUTOMOTIVE" | "PROPERTY";
export type TenantStatus = "TRIAL" | "ACTIVE" | "SUSPENDED";

export interface TenantDto {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly vertical: Vertical;
  readonly status: TenantStatus;
  readonly trialEndsAt?: string;
  readonly hasMetaToken: boolean;
  readonly maskedMetaAdAccountId?: string;
  readonly wabaCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TenantKpiDto {
  readonly totalTenants: number;
  readonly activeTenants: number;
  readonly trialTenants: number;
  readonly suspendedTenants: number;
}

export interface ListTenantsDto {
  readonly kpi: TenantKpiDto;
  readonly tenants: readonly TenantDto[];
}

export interface CreateTenantInput {
  readonly name: string;
  readonly tenantId: string;
  readonly vertical: Vertical;
  readonly adminEmail: string;
  readonly adminPassword: string;
  readonly status: TenantStatus;
  readonly trialDays?: number;
  readonly metaAccessToken?: string;
  readonly metaAdAccountId?: string;
  readonly waba?: {
    readonly branchId: string;
    readonly phoneNumber: string;
    readonly wabaId: string;
    readonly phoneNumberId: string;
    readonly accessToken: string;
  };
}

export interface UpdateTenantInput {
  readonly name?: string;
  readonly vertical?: Vertical;
  readonly status?: TenantStatus;
}

export interface ImpersonateResponseDto {
  readonly tenantId: string;
  readonly adminEmail: string;
  readonly actionLink: string;
}

export interface TenantInfoDto {
  readonly tenantId: string;
  readonly name: string;
  readonly vertical: Vertical;
  readonly status: TenantStatus;
  readonly trialEndsAt?: string;
}

export interface MetaSettingsDto {
  readonly adAccountId?: string;
  readonly accessToken?: string;
  readonly apiVersion: string;
  readonly hasToken: boolean;
  readonly usingEnvDefault: boolean;
}

export interface SettingsDto {
  readonly tenant: TenantInfoDto;
  readonly meta: MetaSettingsDto;
}

export interface TestConnectionResultDto {
  readonly success: boolean;
  readonly message: string;
  readonly accountName?: string;
}

export interface WabaConfigDto {
  readonly id: string;
  readonly branchId: string;
  readonly phoneNumber: string;
  readonly wabaId: string;
  readonly phoneNumberId: string;
  readonly maskedAccessToken: string;
  readonly status: "ACTIVE" | "INACTIVE";
  readonly lastTestedAt?: string;
  readonly lastTestResult?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateWabaConfigInput {
  readonly branchId: string;
  readonly phoneNumber: string;
  readonly wabaId: string;
  readonly phoneNumberId: string;
  readonly accessToken: string;
}

export interface UpdateWabaConfigInput {
  readonly branchId?: string;
  readonly phoneNumber?: string;
  readonly wabaId?: string;
  readonly phoneNumberId?: string;
  readonly accessToken?: string;
  readonly status?: "ACTIVE" | "INACTIVE";
}
