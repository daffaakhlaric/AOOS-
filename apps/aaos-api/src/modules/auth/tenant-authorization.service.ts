import { randomUUID } from "node:crypto";

import { Inject, Injectable, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG } from "../../di-tokens.js";

export type HumanRole = "OWNER" | "ADMIN" | "MEDIA_BUYER" | "CREATIVE" | "VIEWER";
export interface TrustedTenantContext {
  userId: string;
  email?: string;
  workspaceId: string;
  tenantId: string;
  membershipId: string;
  role: HumanRole;
  permissions: readonly string[];
  requestId: string;
  vertical: "PROPERTY" | "AUTOMOTIVE";
  superadmin: boolean;
}
const PERMISSIONS: Record<HumanRole, readonly string[]> = {
  OWNER: ["read", "campaign:write", "creative:write", "integration:manage", "workspace:manage"],
  ADMIN: ["read", "campaign:write", "creative:write", "integration:manage", "workspace:manage"],
  MEDIA_BUYER: ["read", "campaign:write", "creative:write"],
  CREATIVE: ["read", "creative:write"],
  VIEWER: ["read"],
};
@Injectable()
export class TenantAuthorizationService {
  private readonly client: SupabaseClient;
  constructor(@Inject(AAOS_API_CONFIG) config: AaosApiConfig) {
    this.client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  async resolve(
    token: string,
    tenantHint?: string,
    requestId?: string,
  ): Promise<TrustedTenantContext> {
    if (!token) throw new UnauthorizedException("Authenticated user identity required");
    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException("Invalid or expired session");
    const memberships = await this.client
      .from("tenant_memberships")
      .select("id,tenant_id,role")
      .eq("user_id", data.user.id)
      .eq("status", "ACTIVE");
    if (memberships.error) throw new ForbiddenException("Trusted membership unavailable");
    const rows = memberships.data ?? [];
    const member = tenantHint
      ? rows.find((r) => r.tenant_id === tenantHint)
      : rows.length === 1
        ? rows[0]
        : undefined;
    if (!member || !Object.hasOwn(PERMISSIONS, member.role))
      throw new ForbiddenException("Missing membership or explicit workspace selection");
    const tenant = await this.client
      .from("tenants")
      .select("tenant_id,vertical,status")
      .eq("tenant_id", member.tenant_id)
      .single();
    if (
      tenant.error ||
      !tenant.data ||
      tenant.data.status === "SUSPENDED" ||
      !["PROPERTY", "AUTOMOTIVE"].includes(tenant.data.vertical)
    )
      throw new ForbiddenException("Workspace unavailable");
    const admin = await this.client
      .from("superadmin_entitlements")
      .select("enabled")
      .eq("user_id", data.user.id)
      .maybeSingle();
    return {
      userId: data.user.id,
      ...(data.user.email ? { email: data.user.email } : {}),
      workspaceId: member.tenant_id,
      tenantId: member.tenant_id,
      membershipId: member.id,
      role: member.role as HumanRole,
      permissions: PERMISSIONS[member.role as HumanRole],
      requestId: requestId || randomUUID(),
      vertical: tenant.data.vertical,
      superadmin: !admin.error && admin.data?.enabled === true,
    };
  }
  authorize(context: TrustedTenantContext, path: string, method: string): void {
    if (path.includes("/superadmin") || path.includes("/meta-oauth-config")) {
      if (!context.superadmin)
        throw new ForbiddenException("Server-side superadmin entitlement required");
    }
    // OAuth connection initiation changes integration state even when exposed as GET.
    if (
      /\/(?:meta-oauth|oauth\/meta)\/(connect|disconnect|refresh)(?:[/?]|$)/.test(path) &&
      !context.permissions.includes("integration:manage")
    ) {
      throw new ForbiddenException("Role cannot manage integrations");
    }
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return;
    const permission =
      /\/(settings|meta-integration|meta-oauth|oauth\/meta|webhook-config|branches|sales)/.test(
        path,
      )
        ? "integration:manage"
        : /\/(creative|assets|listing-knowledge)/.test(path)
          ? "creative:write"
          : "campaign:write";
    if (!context.permissions.includes(permission))
      throw new ForbiddenException("Role cannot perform this operation");
  }
}
