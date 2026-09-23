import { NextResponse, type NextRequest } from "next/server";
import { resolveRouteSession } from "@/lib/route-session";
export const dynamic = "force-dynamic";
async function handle(request: NextRequest, { params }: { params: { path: string[] } }) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  // Public capabilities contain only format/size limits, never tenant documents.
  const isUploadConfig =
    request.method === "GET" &&
    params.path.length === 2 &&
    params.path[0] === "listing-knowledge" &&
    params.path[1] === "config";
  if (!isUploadConfig && !["manager", "owner", "superadmin"].includes(session.role))
    return NextResponse.json(
      { message: "Akses pengelola diperlukan untuk mengubah listing." },
      { status: 403 },
    );
  const isMetaAssetRead =
    request.method === "GET" &&
    params.path.length === 2 &&
    params.path[0] === "listings" &&
    params.path[1] === "lead-destinations";
  if (!isUploadConfig && !isMetaAssetRead && session.vertical !== "PROPERTY")
    return NextResponse.json(
      {
        message:
          "Fitur ini memerlukan workspace properti (PROPERTY). Pilih akun atau tenant properti untuk menyimpan listing.",
      },
      { status: 403 },
    );
  if (request.method !== "GET" && request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
  const [group, ...parts] = params.path;
  if (
    !["listings", "listing-knowledge"].includes(group ?? "") ||
    parts.some((p) => !/^[-a-zA-Z0-9]+$/.test(p))
  )
    return NextResponse.json({ message: "Invalid path" }, { status: 400 });
  const path = "/api/v1/" + [group, ...parts].join("/");
  const allowed =
    group === "listings"
      ? new RegExp(
          "/listings/(?:lead-destinations|drafts|[a-f0-9-]{36}(?:/(?:draft|finish|photos(?:/(?:reorder|[a-f0-9-]{36}))?))?)$",
        )
      : new RegExp(
          "/listing-knowledge/(?:config|[a-f0-9-]{36}(?:/(?:analyze|search|videos(?:/[a-f0-9-]{36})?|[a-f0-9-]{36}(?:/retry)?))?)$",
        );
  if (!allowed.test(path)) return NextResponse.json({ message: "Invalid path" }, { status: 400 });
  try {
    const body = request.method === "GET" ? undefined : await request.arrayBuffer();
    const response = await fetch(new URL(path, process.env.AAOS_API_BASE_URL), {
      method: request.method,
      headers: {
        "x-api-key": process.env.AAOS_API_KEY ?? "",
        "x-tenant-id": session.tenantId,
        ...(request.headers.get("content-type")
          ? { "content-type": request.headers.get("content-type")! }
          : {}),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(120000),
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      { message: "Layanan belum tersedia. Data form tetap tersimpan di layar." },
      { status: 503 },
    );
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
