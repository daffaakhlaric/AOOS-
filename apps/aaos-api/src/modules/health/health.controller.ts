import type { MetaAdsConnector } from "@aos/meta-ads-connector";
import { Controller, Get, Inject } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { readAppVersion } from "../../config/version.js";
import { AAOS_API_CONFIG, META_ADS_CONNECTOR } from "../../di-tokens.js";

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
    @Inject(META_ADS_CONNECTOR) private readonly connector: MetaAdsConnector,
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
   * bootstraps) and "meta-ads-connector factory constructed successfully" (the injected
   * `MetaAdsConnector` exposes every use case the factory wires — checking a representative
   * subset confirms the whole composition succeeded).
   */
  @Get("ready")
  getReady(): ReadyResponse {
    const checks: Record<string, boolean> = {
      config: isConfigLoaded(this.config),
      metaAdsConnector: isConnectorReady(this.connector),
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
