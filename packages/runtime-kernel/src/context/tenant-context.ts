/** Tenant scoping identifier, mirroring DDD §25 Tenant Isolation / Constitution RULE-016. */
export interface TenantContext {
  readonly tenantId: string;
}
