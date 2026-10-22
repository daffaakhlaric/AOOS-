import { createParamDecorator, ForbiddenException, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

export const TENANT_ID_HEADER = "x-tenant-id";

/**
 * Default tenant id when no `x-tenant-id` header is present — the SAME literal every existing
 * table's `tenant_id TEXT NOT NULL DEFAULT 'dss-motor'` column default already resolves to
 * (coordinator note section 2). `modules/settings`/`modules/superadmin`'s new, genuinely
 * tenant-scoped endpoints are the first in this app to read a *real* per-request tenant id rather
 * than relying on a column default or `AAOS_API_CONFIG.AAOS_TENANT_ID` — this constant exists
 * purely so a request with no header still behaves exactly like every pre-existing endpoint,
 * never a hard 400.
 */
export const DEFAULT_TENANT_ID = "dss-motor";

/**
 * Resolves the tenant id `apps/aaos-dashboard`'s server-side route handlers are expected to
 * forward as `x-tenant-id` (coordinator note section 2: "the real tenant id from the
 * authenticated session ... propagated through aaos-api requests, e.g. as a header the Next.js
 * proxy routes forward"). This is the FIRST real per-request tenant resolution in this app —
 * every pre-existing repository still reads `AAOS_API_CONFIG.AAOS_TENANT_ID` or a column default
 * (Phase 1b sweeps those, per the coordinator note's sequencing) — `modules/settings` is built
 * tenant-scoped from the start since it is brand new.
 */
export function resolveTenantId(request: FastifyRequest): string {
  const context = (request as FastifyRequest & { tenantContext?: { tenantId: string } })
    .tenantContext;
  if (!context?.tenantId) throw new ForbiddenException("Trusted tenant context required");
  return context.tenantId;
}

/** The raw param-decorator factory, exported separately (Nest convention, mirrors `correlationIdFactory`) so it's directly unit-testable without going through Nest's decorator/metadata machinery. */
export function tenantIdFactory(_data: unknown, ctx: ExecutionContext): string {
  const request = ctx.switchToHttp().getRequest<FastifyRequest>();
  return resolveTenantId(request);
}

/** Controller param decorator: `getSettings(@TenantId() tenantId: string)`. */
export const TenantId = createParamDecorator(tenantIdFactory);

/** Actor identity is assigned by ApiKeyGuard after trusted membership resolution. */
export function authenticatedUserIdFactory(_data: unknown, ctx: ExecutionContext): string {
  const request = ctx.switchToHttp().getRequest<
    FastifyRequest & {
      tenantContext?: { userId?: string };
    }
  >();
  const userId = request.tenantContext?.userId;
  if (!userId) throw new ForbiddenException("Trusted actor context required");
  return userId;
}
export const AuthenticatedUserId = createParamDecorator(authenticatedUserIdFactory);
