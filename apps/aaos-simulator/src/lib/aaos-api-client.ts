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

interface AaosApiPromptOverrideResponse {
  readonly agent: string;
  readonly promptKey: string;
  readonly content: string;
  readonly isActive: boolean;
}

function isPromptOverrideResponseArray(value: unknown): value is AaosApiPromptOverrideResponse[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        typeof (row as Partial<AaosApiPromptOverrideResponse>).agent === "string" &&
        typeof (row as Partial<AaosApiPromptOverrideResponse>).promptKey === "string" &&
        typeof (row as Partial<AaosApiPromptOverrideResponse>).content === "string" &&
        typeof (row as Partial<AaosApiPromptOverrideResponse>).isActive === "boolean",
    )
  );
}

const CLARA_SYSTEM_PROMPT_KEY = "clara_system_prompt";

/**
 * A real, honest outcome of trying to fetch the active Clara system-prompt override — never
 * fabricated, so the caller can always tell a real applied override apart from a real, legitimate
 * "nothing to apply" (per the task's own explicit "add a real, honest way to tell whether an
 * override was actually applied" requirement).
 */
export type ClaraPromptOverrideFetchResult =
  | { readonly found: true; readonly content: string }
  | { readonly found: false; readonly reason: string };

/**
 * Fetches the real, currently-active Clara system-prompt override for `tenantId` from
 * `apps/aaos-api`'s `GET /api/v1/learning/prompt-overrides/:tenantId/active` (AAOS Self-Learning
 * AI, Phase C wiring — the real, first live caller of `@aos/sales-agent`'s pre-existing
 * `promptOverride` parameter). Mirrors `fetchListingById`'s exact contract: same
 * `AAOS_API_BASE_URL`/`AAOS_API_KEY`/`x-api-key` convention, same never-throwing discipline — a
 * missing/misconfigured env var, a network failure, a non-2xx response, or an unexpected body
 * shape all resolve to `{ found: false, reason }` (an honest "no active override available", not a
 * fabricated one), so `ClaraSimulationComposer` always falls back to composing with
 * `promptOverride: undefined` (today's real, unchanged behavior) rather than ever failing the
 * simulation itself. Unlike `fetchListingById`, the failure reason is preserved (not collapsed to
 * `undefined`) so the caller can report an honest, specific status back to the user.
 *
 * The endpoint already returns only `is_active = true` rows (`PromptOverrideRepository.
 * listActiveForTenant`'s own `.eq("is_active", true)` filter — verified by direct read), so the
 * `isActive` check below is a defensive belt-and-suspenders, not the primary filter; the real
 * client-side filter this function applies is `agent === "CLARA" && promptKey ===
 * "clara_system_prompt"`, per the task's own instruction.
 */
export async function fetchActiveClaraPromptOverride(
  tenantId: string,
): Promise<ClaraPromptOverrideFetchResult> {
  const baseUrl = process.env["AAOS_API_BASE_URL"];
  const apiKey = process.env["AAOS_API_KEY"];
  if (
    baseUrl === undefined ||
    baseUrl.length === 0 ||
    apiKey === undefined ||
    apiKey.length === 0
  ) {
    return {
      found: false,
      reason: "AAOS_API_BASE_URL/AAOS_API_KEY belum dikonfigurasi di aaos-simulator.",
    };
  }
  if (tenantId.length === 0) {
    return { found: false, reason: "tenantId kosong." };
  }

  let response: Response;
  try {
    response = await fetch(
      new URL(`/api/v1/learning/prompt-overrides/${tenantId}/active`, baseUrl),
      { method: "GET", headers: { "x-api-key": apiKey }, cache: "no-store" },
    );
  } catch (caught) {
    return {
      found: false,
      reason: `Gagal terhubung ke aaos-api: ${caught instanceof Error ? caught.message : String(caught)}`,
    };
  }

  if (!response.ok) {
    return { found: false, reason: `aaos-api merespons status ${String(response.status)}.` };
  }

  let data: unknown;
  try {
    const text = await response.text();
    data = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    return { found: false, reason: "aaos-api mengembalikan body non-JSON." };
  }

  if (!isPromptOverrideResponseArray(data)) {
    return {
      found: false,
      reason: "aaos-api merespons 2xx tapi body tidak sesuai bentuk yang diharapkan.",
    };
  }

  const match = data.find(
    (row) => row.agent === "CLARA" && row.promptKey === CLARA_SYSTEM_PROMPT_KEY && row.isActive,
  );
  if (match === undefined) {
    return {
      found: false,
      reason: `Tidak ada active override untuk (${tenantId}, CLARA, ${CLARA_SYSTEM_PROMPT_KEY}).`,
    };
  }
  return { found: true, content: match.content };
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
