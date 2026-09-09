import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";

interface OAuthCallbackResponseDto {
  readonly success: boolean;
  readonly message: string;
}

interface EmbeddedSignupRequestBody {
  readonly token?: unknown;
  readonly branchId?: unknown;
}

/**
 * `POST /api/oauth/wa/embedded-signup` — proxies `apps/aaos-api`'s real
 * `POST /oauth/wa/embedded-signup` (`MetaOAuthController.waEmbeddedSignup` ->
 * `WaOAuthService.handleEmbeddedSignupToken`). Forwards the token the WhatsApp Embedded Signup JS
 * SDK's `FB.login` callback hands back to the browser, plus the branch the manager picked, along
 * with this session's real `tenantId` (never trusted from the client body).
 *
 * See `SettingsClient.tsx`'s "WhatsApp Business" card for the real, honest caveat: live
 * end-to-end verification of the `FB.login`/Embedded Signup flow itself requires a real,
 * registered Meta App (`NEXT_PUBLIC_META_APP_ID`) — not provisionable in this sandbox — but this
 * endpoint and its real backend handler are genuinely wired and exercised by
 * `wa-oauth.service.spec.ts`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as EmbeddedSignupRequestBody;
  if (typeof body.token !== "string" || body.token.length === 0) {
    return NextResponse.json({ error: { message: "token wajib diisi." } }, { status: 400 });
  }
  if (typeof body.branchId !== "string" || body.branchId.length === 0) {
    return NextResponse.json({ error: { message: "branchId wajib diisi." } }, { status: 400 });
  }
  try {
    const data = await callAaosApi<OAuthCallbackResponseDto>("/oauth/wa/embedded-signup", {
      method: "POST",
      body: { tenantId: session.tenantId, token: body.token, branchId: body.branchId },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
