import { MetaApiClient, MetaSafetyError, CURRENCY_READINESS } from "@aos/meta-ads-connector";
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { META_ADS_CONNECTOR_REGISTRY } from "../../di-tokens.js";
import type { TrustedTenantContext } from "../auth/tenant-authorization.service.js";
import { MetaLeadDestinationsService } from "../listings/meta-lead-destinations.service.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import type { MetaAdsConnectorRegistry } from "./infrastructure/meta-ads-connector-registry.js";

const READS = {
  READ_ACCOUNT: "",
  READ_CAMPAIGNS: "campaigns",
  READ_ADSETS: "adsets",
  READ_ADS: "ads",
  READ_INSIGHTS: "insights",
} as const;
const WRITES = [
  "CREATE_CAMPAIGN",
  "CREATE_ADSET",
  "CREATE_CREATIVE",
  "CREATE_AD",
  "UPDATE_BUDGET",
  "PAUSE_CAMPAIGN",
  "RESUME_CAMPAIGN",
  "PAUSE_AD",
  "RESUME_AD",
  "UPLOAD_IMAGE",
  "UPLOAD_VIDEO",
] as const;
export type CapabilityState = "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN" | "DEGRADED";
@Injectable()
export class MetaExecutionReadinessService {
  private readonly client = new MetaApiClient({ timeoutMs: 15000 });
  constructor(
    @Inject(META_ADS_CONNECTOR_REGISTRY) private readonly registry: MetaAdsConnectorRegistry,
    private readonly destinations: MetaLeadDestinationsService,
    private readonly tenants: TenantRepository,
  ) {}
  async inspect(identity: TrustedTenantContext) {
    const capabilities: Record<string, { state: CapabilityState; reason: string }> = {};
    for (const action of [...Object.keys(READS), ...WRITES])
      capabilities[action] = { state: "UNKNOWN", reason: "Belum diverifikasi" };
    const resolved = await this.registry.resolve(identity.tenantId);
    if (!resolved.ok)
      return {
        connectionStatus: "NOT_CONNECTED",
        capabilities,
        readiness: "BLOCKED",
        issues: ["Credential terenkripsi dan akun eksplisit diperlukan."],
        budgetWriteVerification: "BUDGET_WRITE_UNVERIFIED",
      };
    const ctx = resolved.value;
    if (ctx.adAccountIds.length !== 1)
      throw new ForbiddenException("Explicit single selected account required");
    const accountId = ctx.adAccountIds[0]!;
    const account = await this.client.readGraph(
      accountId,
      ctx.accessToken,
      "id,name,currency,account_status,disable_reason",
    );
    let connectionStatus = "CONNECTED";
    if (!account.ok)
      connectionStatus =
        account.error instanceof MetaSafetyError &&
        account.error.normalizedCode === "META_AUTH_ERROR"
          ? "AUTH_INVALID"
          : account.error instanceof MetaSafetyError &&
              account.error.normalizedCode === "META_PERMISSION_ERROR"
            ? "PERMISSION_LIMITED"
            : "DEGRADED";
    else if (account.value.id !== accountId) connectionStatus = "ACCOUNT_MISMATCH";
    capabilities.READ_ACCOUNT = {
      state: connectionStatus === "CONNECTED" ? "AVAILABLE" : "UNAVAILABLE",
      reason: connectionStatus,
    };
    if (connectionStatus === "CONNECTED")
      await Promise.all(
        Object.entries(READS)
          .filter(([, edge]) => edge)
          .map(async ([action, edge]) => {
            const result = await this.client.readGraph(
              accountId + "/" + edge,
              ctx.accessToken,
              edge === "insights" ? "account_id,spend" : "id",
            );
            capabilities[action] = {
              state: result.ok ? "AVAILABLE" : "DEGRADED",
              reason: result.ok ? "Provider read berhasil" : "Provider read belum berhasil",
            };
          }),
      );
    const permissionResult = await this.client.readGraph(
      "me/permissions",
      ctx.accessToken,
      "permission,status",
    );
    const permissions =
      permissionResult.ok && Array.isArray(permissionResult.value.data)
        ? (permissionResult.value.data as { permission: string; status: string }[])
        : [];
    const management = permissions.some(
      (p) => p.permission === "ads_management" && p.status === "granted",
    );
    for (const action of WRITES)
      capabilities[action] = {
        state: permissionResult.ok && !management ? "UNAVAILABLE" : "UNKNOWN",
        reason: management
          ? "Permission ada; write belum diverifikasi"
          : "Permission/action belum terbukti",
      };
    if (!ctx.selectedPageId)
      for (const action of ["CREATE_CREATIVE", "CREATE_AD"])
        capabilities[action] = { state: "UNAVAILABLE", reason: "Page belum dipilih" };
    capabilities.UPDATE_BUDGET = { state: "UNAVAILABLE", reason: "BUDGET_WRITE_UNVERIFIED" };
    const currency = account.ok ? String(account.value.currency ?? "") : undefined;
    const health = {
      connectionStatus,
      integrationId: ctx.integrationId,
      credentialVersion: ctx.credentialVersion,
      credentialSource: ctx.credentialSource,
      selectedAdAccount: { id: accountId, name: account.ok ? account.value.name : undefined },
      selectedPageId: ctx.selectedPageId ?? null,
      currency,
      lastValidatedAt: account.ok ? new Date().toISOString() : null,
      capabilities,
      readiness: "BLOCKED",
      executionTier: "READ_ONLY",
      budgetWriteVerification: currency
        ? (CURRENCY_READINESS[currency]?.status ?? "BUDGET_WRITE_BLOCKED")
        : "BUDGET_WRITE_UNVERIFIED",
      issues: [
        ...(process.env["META_REAL_WRITES_ENABLED"] === "true" ? [] : ["META_WRITE_DISABLED"]),
        "Write belum diverifikasi; executor Phase 4 diperlukan.",
      ],
    };
    await this.tenants.updateMetaAtVersion(identity.tenantId, ctx.credentialVersion ?? 0, {
      meta_integration_status: connectionStatus,
      meta_last_validated_at: health.lastValidatedAt,
      meta_capabilities: {
        credentialVersion: ctx.credentialVersion,
        checkedAt: new Date().toISOString(),
        capabilities,
      },
    });
    return health;
  }
  async resources(identity: TrustedTenantContext) {
    const resolved = await this.registry.resolve(identity.tenantId);
    if (!resolved.ok) throw new ForbiddenException("Integration unavailable");
    const ctx = resolved.value;
    const [accounts, assets] = await Promise.all([
      this.client.readGraph("me/adaccounts", ctx.accessToken, "id,name"),
      this.destinations.list(identity.tenantId),
    ]);
    const instagram = await Promise.all(
      assets.pages.map(async (page) => {
        const result = await this.client.readGraph(
          page.id,
          ctx.accessToken,
          "id,instagram_business_account{id,username}",
        );
        const ig = result.ok ? result.value.instagram_business_account : undefined;
        return ig && typeof ig === "object" && "id" in ig ? { ...ig, pageId: page.id } : undefined;
      }),
    );
    const tenant = await this.tenants.findByTenantId(identity.tenantId);
    return {
      credentialVersion: ctx.credentialVersion,
      selectedAdAccountId: assets.adAccountId,
      selectedPageId: tenant?.meta_page_id ?? null,
      selectedInstagramId: tenant?.meta_instagram_id ?? null,
      selectedWhatsAppNumber: tenant?.meta_whatsapp_destination ?? null,
      accounts: accounts.ok ? accounts.value.data : [],
      pages: assets.pages,
      whatsappNumbers: assets.whatsappNumbers,
      instagramAccounts: instagram.filter(Boolean),
      issues: [
        ...(!accounts.ok ? ["Account discovery unavailable"] : []),
        ...(assets.warning ? [assets.warning] : []),
      ],
    };
  }
  async selectDestinations(
    identity: TrustedTenantContext,
    input: {
      credentialVersion: number;
      pageId: string;
      instagramId?: string | null;
      whatsappNumber?: string | null;
    },
  ) {
    const resources = await this.resources(identity);
    if (resources.credentialVersion !== input.credentialVersion)
      throw new ForbiddenException("Integration changed; reload before selecting resources");
    if (!resources.pages.some((page) => page.id === input.pageId))
      throw new ForbiddenException("Page is not available for this account");
    const connection = await this.registry.resolve(identity.tenantId);
    if (!connection.ok || connection.value.credentialVersion !== input.credentialVersion)
      throw new ForbiddenException("Integration changed; reload before selecting resources");
    const promotion = await this.client.readGraph(
      resources.selectedAdAccountId + "/promote_pages",
      connection.value.accessToken,
      "id",
    );
    const promotable =
      promotion.ok &&
      Array.isArray(promotion.value.data) &&
      promotion.value.data.some(
        (page: unknown) =>
          !!page && typeof page === "object" && "id" in page && page.id === input.pageId,
      );
    if (!promotable)
      throw new ForbiddenException(
        "Page advertising assignment is not verified for the selected account",
      );
    if (
      input.instagramId &&
      !resources.instagramAccounts.some(
        (ig) => ig?.pageId === input.pageId && ig.id === input.instagramId,
      )
    )
      throw new ForbiddenException("Instagram does not belong to the selected Page");
    const number = input.whatsappNumber
      ? resources.whatsappNumbers.find((phone) => phone.displayNumber === input.whatsappNumber)
          ?.displayNumber
      : null;
    if (input.whatsappNumber && !number)
      throw new ForbiddenException("WhatsApp is not available for this business");
    await this.tenants.updateMetaAtVersion(identity.tenantId, input.credentialVersion, {
      meta_page_id: input.pageId,
      meta_instagram_id: input.instagramId ?? null,
      meta_whatsapp_destination: number,
    });
    this.registry.invalidate(identity.tenantId);
    return {
      saved: true,
      executionTier: "READ_ONLY",
      message:
        "Destinations saved. Ad delivery and Page-to-WhatsApp linkage still require preflight verification.",
    };
  }
  /** Resource routing hints never override the selected tenant integration. */
  async authorizeResources(identity: TrustedTenantContext, request: FastifyRequest): Promise<void> {
    const hints: Record<string, unknown> = {
      ...(request.query as object),
      ...(request.body as object),
      ...(request.params as object),
    };
    const keys = ["campaignId", "campaign_id", "adSetId", "adsetId", "adset_id", "adId", "ad_id"];
    if (/\/(campaigns|adsets|ads)\//.test(request.url)) keys.push("id");
    const ids = keys.flatMap((key) =>
      typeof hints[key] === "string" && /^\d+$/.test(hints[key] as string)
        ? [hints[key] as string]
        : [],
    );
    hints.adAccountId ??= hints.ad_account_id;
    if (hints.adAccountId === undefined && ids.length === 0) return;
    const resolved = await this.registry.resolve(identity.tenantId);
    if (!resolved.ok) throw new ForbiddenException("Integration unavailable");
    const ctx = resolved.value;
    const selected = ctx.adAccountIds.length === 1 ? ctx.adAccountIds[0] : undefined;
    if (!selected || (hints.adAccountId !== undefined && hints.adAccountId !== selected))
      throw new ForbiddenException("META_ACCOUNT_MISMATCH");
    for (const id of ids) {
      const proof = await this.client.verifyObjectState(id, selected, {}, ctx.accessToken);
      if (proof.status !== "VERIFIED")
        throw new ForbiddenException("Resource ownership not verified");
    }
  }
}
