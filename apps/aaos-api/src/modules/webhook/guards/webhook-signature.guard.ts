import type { WebhookVerifier } from "@aos/meta-ads-connector";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { WEBHOOK_SECRETS_SERVICE, WEBHOOK_VERIFIER } from "../../../di-tokens.js";
import type { WebhookSecretsService } from "../../webhook-config/webhook-secrets.service.js";

const SIGNATURE_HEADER = "x-hub-signature-256";

export interface RequestWithRawBody extends FastifyRequest {
  rawBody?: Buffer;
}

/**
 * Guards `POST /webhooks/meta` by wrapping `@aos/meta-ads-connector`'s real `WebhookVerifier` —
 * this app never reimplements HMAC verification. Reads `request.rawBody` (the exact bytes Meta
 * sent, captured by `@nestjs/platform-fastify`'s `rawBody: true` application option, enabled in
 * `create-app.ts` — NOT `request.body`, which has already been JSON-parsed and is not guaranteed
 * byte-identical to what Meta signed).
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  constructor(
    @Inject(WEBHOOK_VERIFIER) private readonly verifier: WebhookVerifier,
    @Inject(WEBHOOK_SECRETS_SERVICE) private readonly webhookSecrets: WebhookSecretsService,
  ) {}

  /**
   * Now `async` (coordinator note Part C item 4 — NestJS's guard contract accepts both sync and
   * async `canActivate` uniformly) so the real app-secret comes from
   * `WebhookSecretsService.getMetaSecrets()` (DB-override-first, `.env`-fallback) instead of
   * `this.config.META_WEBHOOK_APP_SECRET` directly — a superadmin-saved override genuinely takes
   * effect on this guard, not just on the value `webhook.service.ts` reads afterward.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithRawBody>();
    const signatureHeader = request.headers[SIGNATURE_HEADER];
    const signature = typeof signatureHeader === "string" ? signatureHeader : undefined;
    const rawBody = request.rawBody !== undefined ? request.rawBody.toString("utf8") : "";

    const { appSecret } = await this.webhookSecrets.getMetaSecrets();
    const result = this.verifier.verifySignature(rawBody, signature, appSecret);
    if (!result.ok) {
      throw new UnauthorizedException(result.error.message);
    }

    return true;
  }
}
