import { timingSafeEqual } from "node:crypto";

import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import type { AaosApiConfig } from "../../../config/aaos-api.config.js";
import { AAOS_API_CONFIG } from "../../../di-tokens.js";

const API_KEY_HEADER = "x-api-key";

/**
 * `x-api-key` header auth (Bearer-token substitute, per the spec — "no JWT yet") for the Meta
 * Ads endpoints. Compares against `config.API_KEY` using `crypto.timingSafeEqual` — the same
 * security discipline `@aos/meta-ads-connector`'s `WebhookVerifier` uses for signature
 * comparison — never `===`, to avoid leaking timing information about how many leading bytes of
 * the key matched.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(@Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const provided = request.headers[API_KEY_HEADER];

    if (typeof provided !== "string" || provided.length === 0) {
      throw new UnauthorizedException("Missing x-api-key header");
    }

    const expected = Buffer.from(this.config.API_KEY, "utf8");
    const actual = Buffer.from(provided, "utf8");

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException("Invalid x-api-key");
    }

    return true;
  }
}
