import type { WebhookVerifier } from "@aos/whatsapp-connector";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import type { AaosApiConfig } from "../../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, WHATSAPP_WEBHOOK_VERIFIER } from "../../../di-tokens.js";

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
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(WHATSAPP_WEBHOOK_VERIFIER) private readonly verifier: WebhookVerifier,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithRawBody>();
    const signatureHeader = request.headers[SIGNATURE_HEADER];
    const signature = typeof signatureHeader === "string" ? signatureHeader : undefined;
    const rawBody = request.rawBody !== undefined ? request.rawBody.toString("utf8") : "";

    // Result intentionally discarded here — see class doc. The real gate is inside
    // `ProcessIncomingWebhook`, not this guard.
    this.verifier.verifySignature(rawBody, signature, this.config.WHATSAPP_WEBHOOK_APP_SECRET);

    return true;
  }
}
