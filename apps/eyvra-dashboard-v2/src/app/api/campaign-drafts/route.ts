import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { resolveRouteSession } from "@/lib/route-session";
import { AaosApiError, callAaosApi } from "@/lib/api";
import { validDraft } from "@/lib/campaign-builder";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const base = "/api/v1/creative-packages/handoff/drafts";
const headers = { "Cache-Control": "private, no-store" };

function failure(error: unknown) {
  return NextResponse.json(
    {
      message:
        error instanceof AaosApiError
          ? error.message
          : "Draft belum tersimpan. Periksa koneksi layanan.",
    },
    { status: error instanceof AaosApiError ? error.statusCode : 503, headers },
  );
}

export async function GET(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[a-f0-9-]{36}$/.test(id))
    return NextResponse.json({ message: "Invalid draft ID" }, { status: 400 });
  try {
    return NextResponse.json(
      await callAaosApi(base + "/" + id, {
        headers: { "x-tenant-id": session.tenantId },
        timeoutMs: 20000,
      }),
      { headers },
    );
  } catch (error) {
    if (!(error instanceof AaosApiError) || error.statusCode !== 404) return failure(error);
    // Read-only compatibility for pre-migration drafts. The next explicit Save imports to Supabase.
    try {
      const file = path.join(
        process.env.CAMPAIGN_DRAFT_DIR ?? path.join(process.cwd(), ".campaign-drafts"),
        createHash("sha256").update(session.tenantId).digest("hex"),
        id + ".json",
      );
      const old = JSON.parse(await readFile(file, "utf8"));
      return NextResponse.json({ ...old, revision: 0, migrationRequired: true }, { headers });
    } catch {
      return failure(error);
    }
  }
}

export async function POST(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (
    session.vertical !== "PROPERTY" ||
    !["owner", "manager", "superadmin"].includes(session.role) ||
    request.headers.get("origin") !== request.nextUrl.origin
  )
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 100000)
    return NextResponse.json({ message: "Draft terlalu besar." }, { status: 413 });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
  if (!validDraft(body))
    return NextResponse.json({ message: "Draft tidak valid." }, { status: 400 });
  try {
    return NextResponse.json(
      await callAaosApi(base, {
        method: "POST",
        headers: { "x-tenant-id": session.tenantId },
        timeoutMs: 60000,
        body: {
          id: body.id,
          listingId: body.listingId,
          name: body.name,
          goal: body.goal,
          dailyBudget: body.dailyBudget,
          start: body.start,
          end: body.end,
          copyIndex: body.copyIndex,
          metaDestination: body.metaDestination?.pageId ? body.metaDestination : null,
          expectedRevision: body.revision ?? 0,
        },
      }),
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
