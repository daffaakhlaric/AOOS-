import type { Result } from "@aos/common";
import type { TokenVerificationError, WebhookVerifier } from "@aos/meta-ads-connector";
import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import {
  AAOS_API_CONFIG,
  META_ADS_CONNECTOR_REGISTRY,
  WEBHOOK_SECRETS_SERVICE,
  WEBHOOK_VERIFIER,
} from "../../di-tokens.js";
import { AdTenantIndexRepository } from "../meta-ads/infrastructure/ad-tenant-index.repository.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";
import type { WebhookSecretsService } from "../webhook-config/webhook-secrets.service.js";

export interface WebhookReceivedResponse {
  readonly received: true;
}

/** How long `resolveTenantId` waits on the `ad_tenant_index` lookup before giving up on it — a slow/hanging downstream Supabase call must never hold up the fast `200` Meta expects from this webhook (same rationale as the never-throw discipline documented on `resolveTenantId` itself). */
const TENANT_LOOKUP_TIMEOUT_MS = 3_000;

/** Races `promise` against a timer; resolves `undefined` (never rejects) if the timer wins. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      },
    );
  });
}

/**
 * Best-effort, duck-typed extraction of Meta's real webhook `ad_id` field — confirmed by direct
 * read of `@aos/meta-ads-connector`'s own `MetaWebhookPayloadSchema`/`MetaWebhookChangeSchema`
 * (`packages/meta-ads-connector/src/types/MetaWebhookTypes.ts`), which both the `leadgen` and
 * `ctwa_message` change-value shapes carry `ad_id` on: a real Meta lead-ads webhook payload's shape
 * is `{ object, entry: [{ changes: [{ field, value: { ad_id, ... } }] }] }`. Mirrors
 * `whatsapp-webhook.service.ts`'s own `extractPhoneNumberId` exactly — this function intentionally
 * does NOT re-implement `WebhookParser`'s full Zod validation (internal to
 * `packages/meta-ads-connector`, deliberately unchanged/unexported by this phase), it only needs
 * the ONE field this service uses for real tenant routing, and tolerates any other
 * malformed/missing shape by returning `undefined` (never throws; `JSON.parse` failures and
 * structurally-wrong payloads are equally "can't route this yet" cases — `resolveTenantId` falls
 * back to `config.AAOS_TENANT_ID` for either, and the resolved tenant's own
 * `processLeadWebhook.execute` still separately, honestly re-validates/re-parses the full payload
 * against its own schema).
 */
export function extractAdId(rawBody: string): string | undefined {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return undefined;
  }
  if (typeof json !== "object" || json === null || !("entry" in json)) {
    return undefined;
  }
  const entry = (json as { entry?: unknown }).entry;
  if (!Array.isArray(entry)) {
    return undefined;
  }
  for (const entryItem of entry as unknown[]) {
    if (typeof entryItem !== "object" || entryItem === null || !("changes" in entryItem)) {
      continue;
    }
    const changes = (entryItem as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) {
      continue;
    }
    for (const change of changes as unknown[]) {
      const adId = (change as { value?: { ad_id?: unknown } })?.value?.ad_id;
      if (typeof adId === "string" && adId.length > 0) {
        return adId;
      }
    }
  }
  return undefined;
}

/**
 * Wires `ProcessLeadWebhook` (`POST`) and `WebhookVerifier.verifyHandshake` (`GET`) from
 * `@aos/meta-ads-connector`. `verifyHandshake` returns its `Result` as-is — per the README's
 * documented HTTP-layer pattern, the `GET` handshake's failure response (`403` + the verifier's
 * own message, echoed as plain text) is a Meta-subscription-protocol detail distinct from this
 * app's general `@aos/errors`/connector error-to-HTTP-status table, so `WebhookController`
 * handles both branches directly rather than throwing into `AaosExceptionFilter`.
 *
 * AAOS-MULTI-TENANT-PHASE1C — real per-tenant routing, closing the one gap Phase 1B
 * (`docs/PROMPT-AAOS-MULTITENANT-PHASE1B.md`) deliberately deferred. Mirrors
 * `whatsapp-webhook.service.ts`'s Phase 1B pattern:
 *
 * - Signature verification stays exactly as before — GLOBAL `WEBHOOK_VERIFIER`/
 *   `META_WEBHOOK_APP_SECRET`, unchanged, still enforced inside `ProcessLeadWebhook.execute`
 *   itself (never made per-tenant — one Meta App receives every tenant's lead-webhook traffic
 *   under one shared secret, same correct shape Phase 1B/1C's coordinator notes both confirm).
 * - BEFORE calling that, this service peeks the raw payload's own `ad_id` (real field, verified
 *   above) and resolves it through the real, durable `AdTenantIndexRepository` — populated by
 *   `indexPulledAdAccount` at all 4 real Meta Ads pull call sites
 *   (scheduler.service.ts/meta-ads.service.ts/intelligence.service.ts/abtesting.service.ts) — so
 *   the payload is processed with the tenantId of whichever tenant's own pull last indexed this
 *   `ad_id`, not always the single static tenant every consumer used to share.
 * - `dss-motor` production-safety fallback (finding #5): an `ad_id` with no index entry (or a
 *   payload whose `ad_id` couldn't be parsed at all) falls back to `config.AAOS_TENANT_ID` — the
 *   existing single-tenant default, zero regression for `dss-motor`'s live traffic — logging a
 *   warning naming the unmapped `ad_id` ONLY in the "found no index entry" case (a payload that
 *   didn't parse at all has nothing to name, and is a materially different, already-inevitable
 *   condition). Never a silent drop, never a thrown error for this branch.
 * - The resolved tenantId's connector is resolved via the EXISTING `MetaAdsConnectorRegistry`
 *   (`META_ADS_CONNECTOR_REGISTRY`, already injected/used everywhere else in this app since Phase
 *   1B) — reused here, not a second registry. On `ConnectorNotConfiguredError` (the index says
 *   tenant X owns this ad, but tenant X's Meta config was since removed/never configured), this
 *   honestly falls back to the SAME static-tenant resolution (`config.AAOS_TENANT_ID`'s own
 *   registry entry, which `MetaAdsConnectorRegistry.resolve` always special-cases to the
 *   process-boot-composed connector — see that class's own doc), logged, never a thrown 5xx for an
 *   inbound webhook Meta expects a fast `200` from.
 * - AAOS-SETTINGS-WEBHOOK-CONFIG (Part C) additionally changes WHERE the verify-token/app-secret
 *   VALUES come from (never whether they're per-tenant — they remain the one global pair):
 *   `verifyHandshake`/`processLeadWebhook` below resolve them through
 *   `WebhookSecretsService.getMetaSecrets()` (DB-override-first, `.env`-fallback, superadmin-
 *   editable) instead of reading `this.config.META_WEBHOOK_VERIFY_TOKEN`/`META_WEBHOOK_APP_SECRET`
 *   directly, so a superadmin-saved override genuinely takes effect here. `verifyHandshake` is now
 *   `async` for this reason — NestJS's guard/handler contract accepts both sync and async uniformly.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(META_ADS_CONNECTOR_REGISTRY) private readonly registry: MetaAdsConnectorRegistry,
    @Inject(WEBHOOK_VERIFIER) private readonly verifier: WebhookVerifier,
    @Inject(WEBHOOK_SECRETS_SERVICE) private readonly webhookSecrets: WebhookSecretsService,
    private readonly adTenantIndex: AdTenantIndexRepository,
  ) {}

  async verifyHandshake(
    mode: string | undefined,
    token: string | undefined,
    challenge: string | undefined,
  ): Promise<Result<string, TokenVerificationError>> {
    const { verifyToken } = await this.webhookSecrets.getMetaSecrets();
    return this.verifier.verifyHandshake(mode, token, challenge, verifyToken);
  }

  async processLeadWebhook(
    rawBody: string,
    signature: string | undefined,
    correlationId: string,
  ): Promise<WebhookReceivedResponse> {
    const adId = extractAdId(rawBody);
    const tenantId = await this.resolveTenantId(adId);

    let connectorResult = await this.registry.resolve(tenantId);
    if (!connectorResult.ok) {
      this.logger.warn(
        `WebhookService: no connector configured for tenant "${tenantId}" (ad_id "${String(adId)}") — falling back to the static tenant: ${connectorResult.error.message}`,
      );
      connectorResult = await this.registry.resolve(this.config.AAOS_TENANT_ID);
    }
    if (!connectorResult.ok) {
      throw connectorResult.error;
    }
    const connector = connectorResult.value;

    const { appSecret } = await this.webhookSecrets.getMetaSecrets();
    const result = await connector.processLeadWebhook.execute({
      rawBody,
      signature,
      webhookAppSecret: appSecret,
      tenantId,
      correlationId,
    });
    if (!result.ok) {
      throw result.error;
    }
    return { received: true };
  }

  /**
   * Real tenant resolution for one webhook payload's `ad_id`: the durable `ad_tenant_index` first
   * (populated by every tenant's own real pulls), falling back to `config.AAOS_TENANT_ID` when the
   * `ad_id` couldn't be extracted at all, or when it was extracted but has no index entry yet (a
   * real ad that hasn't been pulled/indexed since this phase shipped). Logs a warning only for the
   * latter case — see class doc.
   *
   * The lookup itself is also defensive on two axes, neither of which is ever propagated as a
   * thrown 5xx for an inbound webhook Meta expects a fast `200` from (same never-throw discipline
   * `indexPulledAdAccount` already applies to the write side of this same table): a real
   * `AdTenantIndexRepository` failure is caught and logged, and the lookup is raced against
   * `TENANT_LOOKUP_TIMEOUT_MS` so a slow/hanging downstream Supabase call can never hold up this
   * response. Both cases fall back to `config.AAOS_TENANT_ID`, logged the same as "no index entry"
   * — from this method's caller's perspective they are indistinguishable ("couldn't resolve a real
   * tenant in time"), and the fallback is identically safe either way.
   */
  private async resolveTenantId(adId: string | undefined): Promise<string> {
    if (adId === undefined) {
      return this.config.AAOS_TENANT_ID;
    }
    const tenantId = await withTimeout(
      this.adTenantIndex.findTenantByAdMetaId(adId).catch((error: unknown) => {
        this.logger.warn(
          `WebhookService: ad_tenant_index lookup failed for ad_id "${adId}": ${error instanceof Error ? error.message : String(error)}`,
        );
        return undefined;
      }),
      TENANT_LOOKUP_TIMEOUT_MS,
    );
    if (tenantId === undefined) {
      this.logger.warn(
        `WebhookService: no ad_tenant_index entry for ad_id "${adId}" — falling back to the static tenant "${this.config.AAOS_TENANT_ID}"`,
      );
      return this.config.AAOS_TENANT_ID;
    }
    return tenantId;
  }
}
