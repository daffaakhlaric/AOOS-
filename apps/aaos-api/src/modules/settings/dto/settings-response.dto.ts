/** `GET /api/v1/settings` — backs `/settings`'s "Tenant Info" + "Meta Ads Configuration" cards. */
export interface TenantInfoDto {
  readonly tenantId: string;
  readonly name: string;
  readonly vertical: "AUTOMOTIVE" | "PROPERTY";
  readonly status: "TRIAL" | "ACTIVE" | "SUSPENDED";
  readonly trialEndsAt?: string;
}

/**
 * Unlike `TenantResponseDto` (Super Admin's cross-tenant view, which masks everything), this DTO
 * returns the REAL `accessToken` — a tenant admin viewing their OWN `/settings` page is
 * authorized to see their own credential (the mockup's "Show/Hide" toggle needs the real value to
 * toggle, not a permanently-masked placeholder).
 */
export interface MetaSettingsDto {
  readonly adAccountId?: string;
  readonly accessToken?: string;
  readonly apiVersion: string;
  readonly hasToken: boolean;
  /** True when this tenant has no `tenants.meta_access_token` override and this deployment's `META_ACCESS_TOKEN` env var is being used instead (coordinator note section 4's fallback path). */
  readonly usingEnvDefault: boolean;
}

export interface SettingsResponseDto {
  readonly tenant: TenantInfoDto;
  readonly meta: MetaSettingsDto;
}
