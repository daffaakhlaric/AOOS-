import type { WebhookVerifier } from "@aos/whatsapp-connector";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { WEBHOOK_SECRETS_SERVICE, WHATSAPP_WEBHOOK_VERIFIER } from "../../../di-tokens.js";
import type { WebhookSecretsService } from "../../webhook-config/webhook-secrets.service.js";

const SIGNATURE_HEADER = "x-hub-signature-256";

export interface RequestWithRawBody extends FastifyRequest {
  rawBody?: Buffer;
}

/**
 * Deliberately NON-BLOCKING, unlike `WebhookModule`'s `WebhookSignatureGuard` (which throws
 * `UnauthorizedException` -> 401 on a bad signature). This package's spec is explicit —
 * "Critical: Always Return 200" — `POST /webhooks/whatsapp` must never return a 4xx/5xx to Meta,
 * even for an invalid signature, or Meta will keep retrying (and can eventually disable the
 * subscription). This guard still runs the real HMAC verification (via `@aos/whatsapp-connector`'s
 * `WebhookVerifier` — never reimplemented) so an invalid signature is observable at the edge
 * (attached to the request for the interceptor/logger to see), but `canActivate` always returns
 * `true`. The definitive verify-then-skip decision (does this payload actually get processed) is
 * `ProcessIncomingWebhook`'s own `verifySignature` call inside `WhatsAppWebhookService`, which
 * logs and returns a `Result.err` without affecting the HTTP response the controller already sent.
 */
@Injectable()
export class WhatsAppSignatureGuard implements CanActivate {
  constructor(
    @Inject(WHATSAPP_WEBHOOK_VERIFIER) private readonly verifier: WebhookVerifier,
    @Inject(WEBHOOK_SECRETS_SERVICE) private readonly webhookSecrets: WebhookSecretsService,
  ) {}

  /**
   * Now `async` (coordinator note Part C item 4 — NestJS's guard contract accepts both sync and
   * async `canActivate` uniformly) so the real app-secret comes from
   * `WebhookSecretsService.getWhatsappSecrets()` (DB-override-first, `.env`-fallback) instead of
   * `this.config.WHATSAPP_WEBHOOK_APP_SECRET` directly. Still deliberately NON-BLOCKING — see class
   * doc: this guard always resolves `true` regardless of what `verifySignature` reports.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithRawBody>();
    const signatureHeader = request.headers[SIGNATURE_HEADER];
    const signature = typeof signatureHeader === "string" ? signatureHeader : undefined;
    const rawBody = request.rawBody !== undefined ? request.rawBody.toString("utf8") : "";

    // Result intentionally discarded here — see class doc. The real gate is inside
    // `ProcessIncomingWebhook`, not this guard.
    const { appSecret } = await this.webhookSecrets.getWhatsappSecrets();
    this.verifier.verifySignature(rawBody, signature, appSecret);

    return true;
  }
}
