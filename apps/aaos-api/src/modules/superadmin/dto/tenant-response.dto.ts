/**
 * `TenantRow` shaped for the Super Admin dashboard (Part 1's tenant cards + KPI strip). Never
 * carries the raw `meta_access_token`/WABA `access_token` — only a masked ad-account id and a
 * boolean, matching the mockup's "Token: act_752xxxxx" masked display. The tenant's OWN
 * `/settings` page (`modules/settings`) is the one place the real token is ever returned, to the
 * tenant admin who owns it.
 */
export interface TenantResponseDto {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly vertical: "AUTOMOTIVE" | "PROPERTY";
  readonly status: "TRIAL" | "ACTIVE" | "SUSPENDED";
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

export interface ListTenantsResponseDto {
  readonly kpi: TenantKpiDto;
  readonly tenants: readonly TenantResponseDto[];
}

/** Masks everything but the last 4 characters, matching the mockup's "act_752xxxxx" style. */
export function maskTail(value: string, visible = 6): string {
  if (value.length <= visible) {
    return "x".repeat(value.length);
  }
  return `${value.slice(0, visible)}${"x".repeat(Math.max(value.length - visible, 3))}`;
}
