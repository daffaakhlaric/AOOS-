import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const refreshed = NextResponse.next();
  const session = await getSession(request, refreshed);
  const response = session
    ? NextResponse.json({ authenticated: true, workspace: session.tenantId })
    : NextResponse.json(
        {
          message:
            "Sesi atau akses workspace belum tersedia. Pastikan email ini sudah memiliki membership aktif, lalu coba lagi.",
        },
        { status: 403 },
      );
  for (const cookie of refreshed.cookies.getAll()) response.cookies.set(cookie);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
