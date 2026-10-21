import { timingSafeEqual } from "node:crypto";

import type { CanActivate, ExecutionContext } from "@nestjs/common";
import {
  Inject,
  Injectable,
  Optional,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import type { AaosApiConfig } from "../../../config/aaos-api.config.js";
import { AAOS_API_CONFIG } from "../../../di-tokens.js";
import {
  TenantAuthorizationService,
  type TrustedTenantContext,
} from "../../auth/tenant-authorization.service.js";
import { MetaExecutionReadinessService } from "../meta-execution-readiness.service.js";

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
  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Optional() private readonly authorization?: TenantAuthorizationService,
    @Optional() private readonly resourceAuthorization?: MetaExecutionReadinessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const bearer = request.headers.authorization;
    if (!this.authorization || typeof bearer !== "string" || !bearer.startsWith("Bearer "))
      throw new UnauthorizedException("Authenticated user identity required");
    const tenantHint = request.headers["x-tenant-id"];
    const trusted = await this.authorization.resolve(
      bearer.slice(7),
      typeof tenantHint === "string" ? tenantHint : undefined,
      request.id,
    );
    this.authorization.authorize(trusted, request.url, request.method);
    if (!this.resourceAuthorization)
      throw new ForbiddenException("Resource authorization unavailable");
    await this.resourceAuthorization.authorizeResources(trusted, request);
    for (const source of [request.params, request.query, request.body]) {
      if (source && typeof source === "object")
        for (const key of ["tenantId", "tenant_id", "workspaceId"]) {
          const value = (source as Record<string, unknown>)[key];
          if (value !== undefined && value !== trusted.tenantId)
            throw new ForbiddenException("Cross-tenant context denied");
        }
    }
    (request as FastifyRequest & { tenantContext: TrustedTenantContext }).tenantContext = trusted;
    request.headers["x-tenant-id"] = trusted.tenantId;
    request.headers["x-user-id"] = trusted.userId;
    request.headers["x-user-role"] = trusted.role;
    return true;
  }
}
