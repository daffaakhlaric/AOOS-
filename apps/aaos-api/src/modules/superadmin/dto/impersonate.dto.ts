import { z } from "zod";

/**
 * `POST /api/v1/superadmin/impersonate` body — "Login as Tenant" (Part 1). `actorEmail`/`actorId`
 * are the REAL superadmin's own identity, forwarded by `apps/aaos-dashboard`'s
 * `/api/superadmin/impersonate` route handler, which already verified (via `getSession()` reading
 * the real Supabase Auth cookie) that the caller's session has `role === 'superadmin'` before
 * ever reaching this endpoint — the same trust boundary every other `aaos-api` endpoint relies on
 * (the shared `x-api-key` is only ever held by that trusted dashboard server, never the browser).
 * Required (not optional) specifically so `SuperadminService.impersonate`'s audit log line always
 * names who performed the impersonation, never "unknown".
 */
export const ImpersonateBodySchema = z.object({
  tenantId: z.string().min(1, "tenantId must not be empty"),
  actorEmail: z.string().email("actorEmail must be a valid email address"),
  actorId: z.string().min(1, "actorId must not be empty"),
});

export type ImpersonateBodyDto = z.infer<typeof ImpersonateBodySchema>;

export interface ImpersonateResponseDto {
  readonly tenantId: string;
  readonly adminEmail: string;
  /** The real Supabase Auth magic-link URL — the caller (dashboard route handler) hands this straight to the browser, which navigates to it to complete the real sign-in as the tenant admin. */
  readonly actionLink: string;
}
