import type { Result } from "@aos/common";
import { PhoneNumberId } from "@aos/whatsapp-connector";
import type {
  TokenVerificationError,
  WebhookVerifier,
  WhatsAppConnector,
} from "@aos/whatsapp-connector";
import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import {
  AAOS_API_CONFIG,
  WHATSAPP_CONNECTOR,
  WHATSAPP_CONNECTOR_REGISTRY,
  WHATSAPP_WEBHOOK_VERIFIER,
} from "../../di-tokens.js";
import { WabaConfigRepository } from "../settings/infrastructure/waba-config.repository.js";
import type { WhatsAppConnectorRegistry } from "../whatsapp/infrastructure/whatsapp-connector-registry.js";

/**
 * Best-effort, duck-typed extraction of Meta's real webhook `phone_number_id` field — confirmed by
 * direct read of `@aos/whatsapp-connector`'s own `WaWebhookPayloadSchema`/`ProcessIncomingWebhook`
 * (which walks the identical `entry[].changes[].value.metadata.phone_number_id` path): a real
 * WhatsApp Cloud API webhook payload's shape is
 * `{ object, entry: [{ changes: [{ value: { metadata: { phone_number_id } } }] }] }`. This function
 * intentionally does NOT re-implement `WebhookParser`'s full Zod validation (that class is
 * internal to `packages/whatsapp-connector`, deliberately unchanged/unexported by this phase — see
 * the coordinator's own note) — it only needs the ONE field this service uses for real tenant
 * routing, and tolerates any other malformed/missing shape by returning `undefined` (never throws;
 * `JSON.parse` failures and structurally-wrong payloads are equally "can't route this" cases,
 * left for the resolved tenant's own `processIncomingWebhook.execute` to log properly once
 * resolved, or dropped honestly here when no tenant can be determined at all).
 */
export function extractPhoneNumberId(rawBody: string): string | undefined {
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
      const phoneNumberId = (change as { value?: { metadata?: { phone_number_id?: unknown } } })
        ?.value?.metadata?.phone_number_id;
      if (typeof phoneNumberId === "string" && phoneNumberId.length > 0) {
        return phoneNumberId;
      }
    }
  }
  return undefined;
}

/**
 * Wires `ProcessIncomingWebhook` (`POST`) and `WebhookVerifier.verifyHandshake` (`GET`) from
 * `@aos/whatsapp-connector`, mirroring `WebhookService`'s (Meta) structure — except
 * `processIncomingWebhookAsync` deliberately never throws and returns `void`: per this package's
 * "Critical: Always Return 200" rule, the controller has already responded `{ received: true }`
 * by the time this resolves (or fails).
 *
 * AAOS-MULTI-TENANT-PHASE1B (Phase 2) real tenant resolution (coordinator note point 3):
 * signature verification stays exactly as before — the GLOBAL `WHATSAPP_WEBHOOK_APP_SECRET`,
 * unchanged, still enforced inside `ProcessIncomingWebhook.execute` itself (never made per-tenant,
 * per the coordinator note's finding #4: one Meta App receives every tenant's webhook traffic).
 * BEFORE calling that, this service peeks the raw payload's own `phone_number_id` (real field,
 * verified above), looks it up via the real `WabaConfigRepository.findByPhoneNumberId`, and
 * resolves that row's `tenant_id` through the real `WhatsAppConnectorRegistry` — so the payload is
 * verified+processed against the tenant's OWN connector/token, not the one static connector every
 * tenant used to share. An unrecognized `phone_number_id` is real, honest, logged "unknown WABA,
 * dropping" — never a thrown error (which would break signature-verification-passed webhook
 * processing as a system-wide outage vector), and never a guess at which tenant it might belong to.
 *
 * `dss-motor` backward-compat fallback: a `phone_number_id` not found in `waba_configs` (that
 * table predates `dss-motor`'s env-var-configured WABAs — see `WhatsAppConnectorRegistry`'s own
 * class doc) is checked against the STATIC connector's own registry before being dropped — if it
 * matches one of `dss-motor`'s `.env`-configured phone numbers, this resolves to
 * `config.AAOS_TENANT_ID` (which `WhatsAppConnectorRegistry.resolve` special-cases to the same
 * static connector, no DB query needed).
 */
@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(WHATSAPP_CONNECTOR) private readonly staticConnector: WhatsAppConnector,
    @Inject(WHATSAPP_CONNECTOR_REGISTRY) private readonly registry: WhatsAppConnectorRegistry,
    @Inject(WHATSAPP_WEBHOOK_VERIFIER) private readonly verifier: WebhookVerifier,
    private readonly wabaConfigs: WabaConfigRepository,
  ) {}

  verifyHandshake(
    mode: string | undefined,
    token: string | undefined,
    challenge: string | undefined,
  ): Result<string, TokenVerificationError> {
    return this.verifier.verifyHandshake(
      mode,
      token,
      challenge,
      this.config.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    );
  }

  async processIncomingWebhookAsync(
    rawBody: string,
    signature: string | undefined,
    correlationId: string,
  ): Promise<void> {
    const phoneNumberId = extractPhoneNumberId(rawBody);
    if (phoneNumberId === undefined) {
      this.logger.warn(
        "WhatsAppWebhookService: could not extract phone_number_id from webhook payload — dropping",
      );
      return;
    }

    const tenantId = await this.resolveTenantId(phoneNumberId);
    if (tenantId === undefined) {
      this.logger.warn(
        `WhatsAppWebhookService: unknown WABA phone_number_id "${phoneNumberId}" — dropping`,
      );
      return;
    }

    const connectorResult = await this.registry.resolve(tenantId);
    if (!connectorResult.ok) {
      this.logger.warn(
        `WhatsAppWebhookService: no connector configured for tenant "${tenantId}" (phone_number_id "${phoneNumberId}") — dropping: ${connectorResult.error.message}`,
      );
      return;
    }

    await connectorResult.value.processIncomingWebhook.execute({
      rawBody,
      signature,
      webhookAppSecret: this.config.WHATSAPP_WEBHOOK_APP_SECRET,
      tenantId,
      correlationId,
    });
  }

  /**
   * Real tenant resolution for one `phone_number_id`: `waba_configs` first (every tenant onboarded
   * through Settings), falling back to the static `dss-motor` connector's own registered WABA
   * accounts (its `.env`-configured phone numbers, never backfilled into `waba_configs` — see
   * class doc). `undefined` when neither recognizes it.
   */
  private async resolveTenantId(phoneNumberId: string): Promise<string | undefined> {
    const row = await this.wabaConfigs.findByPhoneNumberId(phoneNumberId);
    if (row !== undefined) {
      return row.tenant_id;
    }
    const phoneNumberIdResult = PhoneNumberId.create(phoneNumberId);
    if (!phoneNumberIdResult.ok) {
      return undefined;
    }
    const staticMatch = this.staticConnector.registry.getByPhoneNumberId(phoneNumberIdResult.value);
    return staticMatch.ok ? this.config.AAOS_TENANT_ID : undefined;
  }
}
