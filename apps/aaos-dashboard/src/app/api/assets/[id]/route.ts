import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { AssetDto } from "@/types/dashboard.types";

/** `GET /api/assets/:id` — proxies `GET /api/v1/assets/:id` (asset-detail modal). */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const data = await callAaosApi<AssetDto>(`/api/v1/assets/${encodeURIComponent(params.id)}`);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

/**
 * `DELETE /api/assets/:id` — proxies `DELETE /api/v1/assets/:id`, which ARCHIVES the asset
 * (`AssetStatus.ARCHIVED`) and keeps both the DB row and the GCS object. There is no hard delete
 * anywhere in this domain — `IAssetRepository` has no `delete` method — which is why the UI labels
 * this "Arsipkan", not "Hapus permanen". The updated asset is returned so the caller can see the
 * real new status rather than a `{ deleted: true }` that would misdescribe what happened.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const data = await callAaosApi<AssetDto>(`/api/v1/assets/${encodeURIComponent(params.id)}`, {
      method: "DELETE",
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
