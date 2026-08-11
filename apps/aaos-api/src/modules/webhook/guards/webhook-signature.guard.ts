import type { WebhookVerifier } from "@aos/meta-ads-connector";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import type { AaosApiConfig } from "../../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, WEBHOOK_VERIFIER } from "../../../di-tokens.js";

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
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(WEBHOOK_VERIFIER) private readonly verifier: WebhookVerifier,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithRawBody>();
    const signatureHeader = request.headers[SIGNATURE_HEADER];
    const signature = typeof signatureHeader === "string" ? signatureHeader : undefined;
    const rawBody = request.rawBody !== undefined ? request.rawBody.toString("utf8") : "";

    const result = this.verifier.verifySignature(
      rawBody,
      signature,
      this.config.META_WEBHOOK_APP_SECRET,
    );
    if (!result.ok) {
      throw new UnauthorizedException(result.error.message);
    }

    return true;
  }
}
