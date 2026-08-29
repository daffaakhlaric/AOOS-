import type { PropertyListingData } from "@aos/conversation-simulator";

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8 (spec section 12 point 3/4) — thin fetch wrapper
 * to the real `apps/aaos-api` `GET /api/v1/listings/:id` endpoint, used only by
 * `POST /api/simulate` to resolve the real listing data for a `vertical: "PROPERTY"` simulation
 * request's `listingId`. Mirrors `apps/aaos-dashboard`'s `src/lib/api.ts` `callAaosApi` — same
 * `AAOS_API_BASE_URL`/`AAOS_API_KEY` env var convention, same `x-api-key` header
 * `apps/aaos-api`'s `ApiKeyGuard` requires — but deliberately narrower (one real call, no generic
 * `callAaosApi<T>` abstraction) since this is the only `apps/aaos-api` endpoint this app calls.
 *
 * Server-only by construction: only ever called from `src/app/api/simulate/route.ts`, which always
 * runs on the server.
 *
 * Never throws — a missing/misconfigured `AAOS_API_BASE_URL`/`AAOS_API_KEY`, a network failure, a
 * non-2xx response, or an unexpected body shape all resolve to `undefined` (an honest "no real
 * listing data available", not a fabricated one) so a listing-fetch failure never fails the whole
 * simulation request; `ClaraSimulationComposer`'s PROPERTY branch already composes successfully
 * with 0 listings.
 */

interface AaosApiListingResponse {
  readonly id: string;
  readonly title: string;
  readonly propertyType: string;
  readonly price: number;
  readonly city?: string;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly landArea?: number;
  readonly buildArea?: number;
  readonly waNumber?: string;
  readonly mainPhotoUrl?: string;
}

const VALID_PROPERTY_TYPES: ReadonlySet<string> = new Set([
  "RUMAH",
  "APARTEMEN",
  "RUKO",
  "TANAH",
  "VILLA",
]);

function isValidListingResponse(value: unknown): value is AaosApiListingResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<AaosApiListingResponse>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.propertyType === "string" &&
    VALID_PROPERTY_TYPES.has(candidate.propertyType) &&
    typeof candidate.price === "number"
  );
}

/**
 * Fetches one real listing by id from `apps/aaos-api`'s `GET /api/v1/listings/:id`, mapped into
 * `@aos/conversation-simulator`'s `PropertyListingData` wire shape. Returns `undefined` on any
 * failure — see class-level doc.
 */
export async function fetchListingById(
  listingId: string,
): Promise<PropertyListingData | undefined> {
  const baseUrl = process.env["AAOS_API_BASE_URL"];
  const apiKey = process.env["AAOS_API_KEY"];
  if (
    baseUrl === undefined ||
    baseUrl.length === 0 ||
    apiKey === undefined ||
    apiKey.length === 0
  ) {
    return undefined;
  }

  let response: Response;
  try {
    response = await fetch(new URL(`/api/v1/listings/${listingId}`, baseUrl), {
      method: "GET",
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
  } catch {
    return undefined;
  }

  if (!response.ok) {
    return undefined;
  }

  let data: unknown;
  try {
    const text = await response.text();
    data = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }

  if (!isValidListingResponse(data)) {
    return undefined;
  }

  return {
    id: data.id,
    title: data.title,
    propertyType: data.propertyType as PropertyListingData["propertyType"],
    price: data.price,
    ...(data.city !== undefined ? { city: data.city } : {}),
    ...(data.bedrooms !== undefined ? { bedrooms: data.bedrooms } : {}),
    ...(data.bathrooms !== undefined ? { bathrooms: data.bathrooms } : {}),
    ...(data.landArea !== undefined ? { landArea: data.landArea } : {}),
    ...(data.buildArea !== undefined ? { buildArea: data.buildArea } : {}),
    ...(data.waNumber !== undefined ? { waNumber: data.waNumber } : {}),
    ...(data.mainPhotoUrl !== undefined ? { mainPhotoUrl: data.mainPhotoUrl } : {}),
  };
}
