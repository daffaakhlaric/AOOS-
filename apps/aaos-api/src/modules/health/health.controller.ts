import type { MetaAdsConnector } from "@aos/meta-ads-connector";
import { Controller, Get, Inject } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { readAppVersion } from "../../config/version.js";
import { AAOS_API_CONFIG, META_ADS_CONNECTOR_REGISTRY } from "../../di-tokens.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";

export interface HealthResponse {
  readonly status: "ok";
  readonly version: string;
  readonly timestamp: string;
}

export interface ReadyResponse {
  readonly status: "ready" | "not_ready";
  readonly checks: Record<string, boolean>;
}

/** `GET /health`, `GET /ready` — no auth (per spec). */
@Controller()
export class HealthController {
  private readonly version = readAppVersion();

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(META_ADS_CONNECTOR_REGISTRY)
    private readonly connectorRegistry: MetaAdsConnectorRegistry,
  ) {}

  @Get("health")
  getHealth(): HealthResponse {
    return {
      status: "ok",
      version: this.version,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Real readiness checks, not a hardcoded stub: "config loaded successfully" (the `AaosApiConfig`
   * this controller was constructed with is fully validated — Nest DI would never have reached
   * this constructor otherwise, since `main.ts` fails fast on an invalid config before the app
   * bootstraps) and "meta-ads-connector factory constructed successfully" for the seeded
   * `dss-motor` tenant (AAOS-MULTI-TENANT-PHASE1B Phase 3 — `MetaAdsConnectorRegistry.resolve`'s
   * own `dss-motor` fallback returns the SAME statically-composed connector this check used to
   * receive directly, so this stays a synchronous, no-Supabase-call check exactly as before).
   */
  @Get("ready")
  async getReady(): Promise<ReadyResponse> {
    const connectorResult = await this.connectorRegistry.resolve(this.config.AAOS_TENANT_ID);
    const checks: Record<string, boolean> = {
      config: isConfigLoaded(this.config),
      metaAdsConnector: connectorResult.ok && isConnectorReady(connectorResult.value),
    };
    const ready = Object.values(checks).every(Boolean);
    return {
      status: ready ? "ready" : "not_ready",
      checks,
    };
  }
}

function isConfigLoaded(config: AaosApiConfig): boolean {
  return (
    typeof config.AAOS_TENANT_ID === "string" &&
    config.AAOS_TENANT_ID.length > 0 &&
    config.META_AD_ACCOUNT_IDS.length > 0
  );
}

function isConnectorReady(connector: MetaAdsConnector): boolean {
  return (
    connector.pullCampaignData !== undefined &&
    connector.executeVerdict !== undefined &&
    connector.processLeadWebhook !== undefined
  );
}
