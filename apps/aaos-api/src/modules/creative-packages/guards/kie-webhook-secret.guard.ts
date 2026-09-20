import { timingSafeEqual } from "node:crypto";

import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import type { AaosApiConfig } from "../../../config/aaos-api.config.js";
import { AAOS_API_CONFIG } from "../../../di-tokens.js";

const SECRET_QUERY_PARAM = "secret";

/**
 * PROMPT 53 — KIE WEBHOOK (Phase 41). Guards `POST /api/v1/creative-packages/webhooks/kie`.
 *
 * HONEST LIMIT, documented rather than glossed over: Kie AI's real API (confirmed directly against
 * this codebase's own `KieApiResponseMapper`/`KieAiGenerationClient` — a plain `{code, msg, data}`
 * JSON body, no signature/HMAC header anywhere in any real request or response this package makes)
 * has no documented mechanism for this app to cryptographically verify an inbound callback the way
 * `WebhookSignatureGuard` verifies Meta's `x-hub-signature-256`. A shared secret embedded as a
 * query parameter on the exact `callBackUrl` this app hands Kie AI
 * (`to-creative-connector-config.ts`'s `buildCallbackUrl`) is the honest, standard substitute: only
 * someone who already has that exact URL (i.e. Kie AI, or someone who intercepted it) can produce a
 * request this guard accepts. Compared with `crypto.timingSafeEqual` — same discipline as
 * `ApiKeyGuard` — never `===`, to avoid leaking timing information about how many leading bytes of
 * the secret matched.
 *
 * `config.KIE_WEBHOOK_SECRET` unset (the honest default — see its own `AaosApiConfig` doc comment)
 * means NO real `callbackUrl` was ever handed to Kie AI in the first place
 * (`toCreativeConnectorConfig`'s own doc), so a request reaching this guard at all in that state is
 * never a genuine Kie AI callback — always rejected, never a fabricated "open" mode.
 */
@Injectable()
export class KieWebhookSecretGuard implements CanActivate {
  constructor(@Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const provided = (request.query as Record<string, unknown> | undefined)?.[SECRET_QUERY_PARAM];

    if (this.config.KIE_WEBHOOK_SECRET.length === 0) {
      throw new UnauthorizedException(
        "KieWebhookSecretGuard: KIE_WEBHOOK_SECRET is not configured on this deployment — no real callback was ever issued, so this request cannot be genuine.",
      );
    }
    if (typeof provided !== "string" || provided.length === 0) {
      throw new UnauthorizedException("Missing ?secret= query parameter");
    }

    const expected = Buffer.from(this.config.KIE_WEBHOOK_SECRET, "utf8");
    const actual = Buffer.from(provided, "utf8");

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException("Invalid ?secret= query parameter");
    }

    return true;
  }
}
